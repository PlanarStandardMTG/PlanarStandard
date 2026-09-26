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
  getSourcedTournament,
  replaceStagedMatches,
  replaceTournamentEntries,
  replaceTournamentMatches,
  saveSourcedTournament,
  supersedeOtherImports,
  updateImportStatus,
  type NewTournamentEntry,
} from "@ps/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import { attachEventDecks } from "@/lib/decks/attach-event-decks.server";
import { recomputeRatings } from "@/lib/ratings/recompute-ratings.server";
import { resolveEventHandles } from "@/lib/results/resolve-handles.server";

/**
 * One finished platform event into the ledger (E18.20): the tournament, its
 * import, its players' identities and its matches, then the two lines an admin
 * put it on (E18.22) — ratings when it is rated, and its decklists onto its
 * standings when it brought any.
 *
 * The standings and the decklists are written on every run, a skipped one
 * included, so an event ingested before they were gains them on its next
 * "Re-run".
 *
 * An event is rated when it is on the Elo line — a Monthly by default (E8.7) —
 * and only when it has pairings (ADR 006). An API import commits without E18.4's review
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
  /** On the Elo line. Absent, a Monthly is (`rated-by-default`). */
  readonly rate?: boolean;
  /** On the decklist line. Absent, it is not. */
  readonly decklists?: boolean;
}

export interface IngestReport {
  readonly tournament: Tournament;
  /** False when this exact payload was already committed; nothing was written. */
  readonly written: boolean;
  readonly matches: number;
  readonly issues: ParsedEvent["issues"];
  readonly rated: boolean;
  /** Entries the decklist line gave a deck this run. */
  readonly decks: number;
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
  const before = await getSourcedTournament(service, event);
  const tournament = await saveTournament(service, event, parsed, {
    name,
    date,
    seasonId: season?.id ?? null,
  });
  // The Elo line changed since the last run, so the ladder is out of date whatever else happens.
  const rerated = before !== null && before.isRated !== tournament.isRated;

  const contentHash = createHash("sha256").update(event.input.bytes).digest("hex");
  const existing = await findImportByContentHash(service, tournament.id, contentHash);
  if (existing?.status === "committed") {
    const resolved = await resolveEventHandles(service, event.source, eventHandles(parsed));
    await writeEntries(service, tournament, parsed, resolved.players);
    if (rerated) await recomputeRatings(service, `rerated:${event.source}:${event.externalId}`);
    const decks = await writeDecklists(service, event, tournament, parsed, resolved.players);
    return { tournament, written: false, matches: 0, issues: parsed.issues, rated: false, decks };
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

  if (tournament.isRated || rerated) {
    await recomputeRatings(service, `ingest:${event.source}:${event.externalId}`);
  }
  const decks = await writeDecklists(service, event, tournament, parsed, resolved.players);

  return {
    tournament,
    written: true,
    matches: committed,
    issues,
    rated: tournament.isRated,
    decks,
  };
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
 * The decklist line (E18.23): whatever lists the source sent, onto their
 * players' entries. melee.gg sends them only sometimes and Challonge never;
 * an admin's sheet fills the gaps (E20.37). Card and archetype statistics
 * (E18.13) will recompute from here once they exist.
 */
async function writeDecklists(
  service: SupabaseClient,
  event: IngestSource,
  tournament: Tournament,
  parsed: ParsedEvent,
  players: ReadonlyMap<string, PlayerId>,
): Promise<number> {
  if (event.decklists !== true) return 0;
  const decks = (parsed.decklists ?? []).flatMap((list) => {
    const playerId = players.get(list.handle);
    return playerId === undefined
      ? []
      : [
          {
            playerId,
            deck: { kind: "text" as const, text: list.decklistText },
            ...(list.deckName === undefined ? {} : { name: list.deckName }),
            ...(list.archetypeRaw === undefined ? {} : { archetypeRaw: list.archetypeRaw }),
          },
        ];
  });
  if (decks.length === 0) return 0;
  return (await attachEventDecks(service, tournament, decks, "registration")).attached;
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
        isRated:
          (event.rate ?? ratedByDefault(known.name)) && parsed.capabilities.includes("matches"),
      });
    } catch (error) {
      const slugTaken = error instanceof Error && /tournaments_slug_key/.test(error.message);
      if (!slugTaken || attempt >= MAX_SLUG_ATTEMPTS) throw error;
    }
  }
}
