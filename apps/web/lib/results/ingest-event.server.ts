import { createHash } from "node:crypto";

import type {
  EventSource,
  IsoDate,
  ParsedEvent,
  PlayerId,
  RawInput,
  ResultsAdapter,
  Tournament,
} from "@ps/contracts";
import { eventEntries, eventSlug, ledgerMatches, ratedByDefault } from "@ps/core";
import {
  createImport,
  findImportByContentHash,
  findSeasonForDate,
  replaceStagedMatches,
  replaceTournamentEntries,
  replaceTournamentMatches,
  saveSourcedTournament,
  supersedeOtherImports,
  updateImportStatus,
  type NewTournamentEntry,
} from "@ps/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import { recomputeRatings } from "@/lib/ratings/recompute-ratings.server";
import { resolveEventHandles } from "@/lib/results/resolve-handles.server";

/**
 * One finished platform event into the ledger (E18.20): the tournament, its
 * import, its players' identities and its matches, then two independent
 * follow-ups — ratings when the event is rated, and deck processing when it
 * brought decklists.
 *
 * The standings are written on every run, a skipped one included, so an event
 * ingested before they were (E18.21) gains them on its next "Re-run".
 *
 * Every event is ingested; only a Monthly is rated by default (E8.7), and only
 * when it has pairings (ADR 006). An API import commits without E18.4's review
 * queue, because resolution is exact-match only (E18.3). Re-ingesting supersedes
 * the earlier import and replaces the matches wholesale (§26).
 */

export interface IngestSource {
  readonly source: EventSource;
  readonly externalId: string;
  readonly adapter: ResultsAdapter;
  readonly input: RawInput;
  /** When the event has no date of its own in the payload. */
  readonly fallbackDate: IsoDate;
}

export interface IngestReport {
  readonly tournament: Tournament;
  /** False when this exact payload was already committed; nothing was written. */
  readonly written: boolean;
  readonly matches: number;
  readonly issues: ParsedEvent["issues"];
  readonly rated: boolean;
}

const MAX_SLUG_ATTEMPTS = 20;

export async function ingestEvent(
  service: SupabaseClient,
  event: IngestSource,
): Promise<IngestReport> {
  const parsed = event.adapter.parse(event.input);
  const parsedMatches = parsed.matches ?? [];
  if (parsedMatches.length === 0) {
    const reasons = parsed.issues.map((issue) => issue.message).join(" ");
    throw new Error(
      `${event.source} event ${event.externalId} has no matches to ingest. ${reasons}`,
    );
  }

  const date = parsed.date ?? event.fallbackDate;
  const name = parsed.name ?? `${event.source} event ${event.externalId}`;
  const season = await findSeasonForDate(service, date);
  const tournament = await saveTournament(service, event, parsed, {
    name,
    date,
    seasonId: season?.id ?? null,
  });

  const contentHash = createHash("sha256").update(event.input.bytes).digest("hex");
  const existing = await findImportByContentHash(service, tournament.id, contentHash);
  if (existing?.status === "committed") {
    const resolved = await resolveEventHandles(service, event.source, eventHandles(parsed));
    await writeEntries(service, tournament, parsed, resolved.players);
    return { tournament, written: false, matches: 0, issues: parsed.issues, rated: false };
  }

  const upload =
    existing ??
    (await createImport(service, {
      tournamentId: tournament.id,
      adapterId: event.adapter.id,
      contentHash,
      capabilities: parsed.capabilities,
      sourcePlatform: event.source,
      fileName: event.input.fileName,
      rowCount: parsedMatches.length,
    }));

  await replaceStagedMatches(
    service,
    upload.id,
    parsedMatches.map((match) => ({
      rowIndex: match.rowIndex,
      raw: match.raw,
      round: match.round ?? null,
      tableNumber: match.tableNumber ?? null,
      p1Handle: match.p1Handle,
      p2Handle: match.p2Handle ?? null,
      p1Games: match.p1Games ?? null,
      p2Games: match.p2Games ?? null,
      gameDraws: match.gameDraws ?? null,
      result: match.result,
      isElimination: match.isElimination ?? false,
      issues: parsed.issues.filter((issue) => issue.rowIndex === match.rowIndex),
    })),
  );

  const resolved = await resolveEventHandles(service, event.source, eventHandles(parsed));
  const ledger = ledgerMatches(parsedMatches, resolved.identities);
  const committed = await replaceTournamentMatches(
    service,
    tournament.id,
    upload.id,
    ledger.matches,
  );

  const issues = [...parsed.issues, ...resolved.issues, ...ledger.issues];
  await updateImportStatus(service, upload.id, "committed", {
    rowCount: parsedMatches.length,
    errors: issues.map((issue) => ({ ...issue })),
    committedAt: new Date().toISOString(),
  });
  await supersedeOtherImports(service, tournament.id, upload.id);
  await writeEntries(service, tournament, parsed, resolved.players);

  if (tournament.isRated) {
    await recomputeRatings(service, `ingest:${event.source}:${event.externalId}`);
  }
  if ((parsed.decklists ?? []).length > 0) {
    await onDecklistsIngested(tournament, parsed);
  }

  return { tournament, written: true, matches: committed, issues, rated: tournament.isRated };
}

/** Everyone the pairings or the standings name. */
function eventHandles(parsed: ParsedEvent): string[] {
  return [
    ...(parsed.matches ?? []).flatMap((match) =>
      match.p2Handle === undefined ? [match.p1Handle] : [match.p1Handle, match.p2Handle],
    ),
    ...(parsed.standings ?? []).map((standing) => standing.handle),
  ];
}

/**
 * One entry per player. Two handles resolving to one player cannot both have
 * finished (the co-appearance rule), but if they did, the better finish stands.
 */
async function writeEntries(
  service: SupabaseClient,
  tournament: Tournament,
  parsed: ParsedEvent,
  players: ReadonlyMap<string, PlayerId>,
): Promise<void> {
  const byPlayer = new Map<PlayerId, NewTournamentEntry>();
  for (const { handle, ...entry } of eventEntries(parsed)) {
    const playerId = players.get(handle);
    if (playerId === undefined) continue;
    const kept = byPlayer.get(playerId);
    if (kept === undefined || (entry.placement ?? Infinity) < (kept.placement ?? Infinity)) {
      byPlayer.set(playerId, { ...entry, playerId });
    }
  }
  await replaceTournamentEntries(service, tournament.id, [...byPlayer.values()]);
}

/**
 * The deck path (E18.13–E18.15): store the lists and recompute card and
 * archetype statistics. A no-op until those exist; melee.gg sends lists only
 * sometimes, and Challonge never does.
 */
async function onDecklistsIngested(tournament: Tournament, parsed: ParsedEvent): Promise<void> {
  void tournament;
  void parsed;
}

async function saveTournament(
  service: SupabaseClient,
  event: IngestSource,
  parsed: ParsedEvent,
  known: {
    readonly name: string;
    readonly date: IsoDate;
    readonly seasonId: Tournament["seasonId"];
  },
): Promise<Tournament> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await saveSourcedTournament(service, {
        source: event.source,
        externalId: event.externalId,
        name: known.name,
        slug: eventSlug(known.name, attempt),
        eventDate: known.date,
        seasonId: known.seasonId,
        platform: parsed.platform ?? event.source,
        externalUrl: parsed.externalUrl ?? null,
        structure: parsed.structure ?? null,
        rounds: parsed.rounds ?? null,
        playerCount: parsed.playerCount ?? null,
        isRated: ratedByDefault(known.name) && parsed.capabilities.includes("matches"),
      });
    } catch (error) {
      const slugTaken = error instanceof Error && /tournaments_slug_key/.test(error.message);
      if (!slugTaken || attempt >= MAX_SLUG_ATTEMPTS) throw error;
    }
  }
}
