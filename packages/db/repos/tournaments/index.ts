import type {
  DeckId,
  FormatVersionId,
  IsoDate,
  PlayerId,
  SeasonId,
  Tournament,
  TournamentEntry,
  TournamentId,
  TournamentStatus,
} from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ENTRY_COLUMNS,
  IMPORTED_STATUSES,
  TOURNAMENT_COLUMNS,
  toTournament,
  toTournamentEntry,
  type TournamentEntryRow,
  type TournamentRow,
} from "./rows";

/**
 * Reads over `tournaments` and `tournament_entries` (E13.17).
 *
 * All public-client reads, and all covered by policies that hide a `draft`
 * event. A draft tournament is an organiser's scratch pad — a date and a name
 * before anything has been played — so none of these has to filter it out.
 */

/** One event by the slug its URL uses. Null when unknown, or when it is still a draft. */
export async function getTournamentBySlug(
  client: SupabaseClient,
  slug: string,
): Promise<Tournament | null> {
  const { data, error } = await client
    .from("tournaments")
    .select(TOURNAMENT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error !== null) throw new Error(`getTournamentBySlug failed: ${error.message}`);
  return data === null ? null : toTournament(data as unknown as TournamentRow);
}

/** These events, oldest first — for naming the ones a message is about. */
export async function listTournamentsByIds(
  client: SupabaseClient,
  ids: readonly TournamentId[],
): Promise<readonly Tournament[]> {
  if (ids.length === 0) return [];
  const { data, error } = await client
    .from("tournaments")
    .select(TOURNAMENT_COLUMNS)
    .in("id", ids)
    .order("event_date", { ascending: true });

  if (error !== null) throw new Error(`listTournamentsByIds failed: ${error.message}`);
  return (data as unknown as TournamentRow[]).map(toTournament);
}

/** Every event of a season, newest first — the season's index page. */
export async function listTournamentsBySeason(
  client: SupabaseClient,
  seasonId: SeasonId,
): Promise<readonly Tournament[]> {
  const { data, error } = await client
    .from("tournaments")
    .select(TOURNAMENT_COLUMNS)
    .eq("season_id", seasonId)
    .order("event_date", { ascending: false });

  if (error !== null) throw new Error(`listTournamentsBySeason failed: ${error.message}`);
  return (data as unknown as TournamentRow[]).map(toTournament);
}

/**
 * The rated events of a season, **oldest first** — replay order.
 *
 * The ordering is the contract, not a detail. Elo is path-dependent: the same
 * matches applied in a different order produce different ratings, because each
 * update is computed against the ratings the previous one left behind. A
 * descending sort here would not fail anything — it would quietly produce a
 * different leaderboard (ADR 004, E8.4).
 *
 * `is_rated` is the gate ADR 006 describes: a standings-only import is recorded
 * for metagame purposes and rates nothing, because pairings must never be
 * inferred from placements.
 */
export async function listRatedTournamentsBySeason(
  client: SupabaseClient,
  seasonId: SeasonId,
): Promise<readonly Tournament[]> {
  const { data, error } = await client
    .from("tournaments")
    .select(TOURNAMENT_COLUMNS)
    .eq("season_id", seasonId)
    .eq("is_rated", true)
    .in("status", IMPORTED_STATUSES)
    // Ties broken on slug so a replay of two events on one date is reproducible
    // rather than dependent on what Postgres returned first.
    .order("event_date", { ascending: true })
    .order("slug", { ascending: true });

  if (error !== null) throw new Error(`listRatedTournamentsBySeason failed: ${error.message}`);
  return (data as unknown as TournamentRow[]).map(toTournament);
}

/**
 * The newest events whose results are in and at least one of whose entries has
 * a deck — what the home page's podium picks its Monthly from (E24.5). Same
 * statuses as `getLatestTournamentWithResults`, for the same reason.
 */
export async function listTournamentsWithDecks(
  client: SupabaseClient,
  limit: number,
): Promise<readonly Tournament[]> {
  const { data, error } = await client
    .from("tournaments")
    .select(`${TOURNAMENT_COLUMNS}, tournament_entries!inner (deck_id)`)
    .in("status", IMPORTED_STATUSES)
    .not("tournament_entries.deck_id", "is", null)
    .order("event_date", { ascending: false })
    .order("slug", { ascending: true })
    .limit(limit);

  if (error !== null) throw new Error(`listTournamentsWithDecks failed: ${error.message}`);
  return (data as unknown as TournamentRow[]).map(toTournament);
}

/**
 * The most recent event whose results are in.
 *
 * What the home page's podium reads (E24.5). "Results are in" means committed or
 * verified — an event awaiting results has nothing to show, and an archived one
 * is excluded deliberately: somebody took it down, and resurfacing it on the
 * front page would undo that.
 *
 * Null is the normal answer on a site whose first event has not been imported.
 */
export async function getLatestTournamentWithResults(
  client: SupabaseClient,
): Promise<Tournament | null> {
  const { data, error } = await client
    .from("tournaments")
    .select(TOURNAMENT_COLUMNS)
    .in("status", IMPORTED_STATUSES)
    .order("event_date", { ascending: false })
    .order("slug", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error !== null) throw new Error(`getLatestTournamentWithResults failed: ${error.message}`);
  return data === null ? null : toTournament(data as unknown as TournamentRow);
}

/**
 * One event's standings, best finish first.
 *
 * An entry with no placement sorts last rather than being dropped: a
 * matches-only import knows who played and not who won, and those players were
 * still there.
 */
export async function listTournamentEntries(
  client: SupabaseClient,
  tournamentId: TournamentId,
): Promise<readonly TournamentEntry[]> {
  const { data, error } = await client
    .from("tournament_entries")
    .select(ENTRY_COLUMNS)
    .eq("tournament_id", tournamentId)
    .order("placement", { ascending: true, nullsFirst: false });

  if (error !== null) throw new Error(`listTournamentEntries failed: ${error.message}`);
  return (data as unknown as TournamentEntryRow[]).map(toTournamentEntry);
}

/** An event as a platform reported it, keyed by that platform's id for it (E18.20). */
export interface SourcedTournament {
  readonly source: string;
  readonly externalId: string;
  readonly name: string;
  /** Used only when the row is new; a tournament's URL never changes under it. */
  readonly slug: string;
  readonly eventDate: IsoDate;
  readonly seasonId: SeasonId | null;
  readonly platform: string | null;
  readonly externalUrl: string | null;
  readonly structure: string | null;
  readonly rounds: number | null;
  readonly playerCount: number | null;
  /**
   * Where a new tournament starts (E25.1): rated and in card statistics or not.
   * Written only when the row is created — after that they are an admin's
   * choice on `/admin/processing`, and a re-fetch leaves them alone.
   */
  readonly isRated: boolean;
  readonly inCardStats: boolean;
}

/** Statuses an ingest moves on to `results_imported`. Verified or archived is a person's call, and stays. */
const PRE_RESULTS_STATUSES: readonly TournamentStatus[] = ["draft", "awaiting_results"];

/**
 * Create or refresh the tournament a platform event became.
 *
 * Found by `(source, external_id)`, so ingesting an event twice updates one row.
 * A refresh rewrites what the platform knows — name, date, season, shape — and
 * leaves the slug, what the event counts towards (E25.1), and a status past
 * `results_imported` alone. A new row fails on a taken slug; the caller retries with
 * another.
 */
export async function saveSourcedTournament(
  serviceClient: SupabaseClient,
  tournament: SourcedTournament,
): Promise<Tournament> {
  const { data: existing, error: findError } = await serviceClient
    .from("tournaments")
    .select(TOURNAMENT_COLUMNS)
    .eq("source", tournament.source)
    .eq("external_id", tournament.externalId)
    .maybeSingle();
  if (findError !== null) throw new Error(`saveSourcedTournament failed: ${findError.message}`);

  const reported = {
    name: tournament.name,
    event_date: tournament.eventDate,
    season_id: tournament.seasonId,
    platform: tournament.platform,
    external_url: tournament.externalUrl,
    structure: tournament.structure,
    rounds: tournament.rounds,
    player_count: tournament.playerCount,
  };

  const write =
    existing === null
      ? serviceClient.from("tournaments").insert({
          ...reported,
          source: tournament.source,
          external_id: tournament.externalId,
          slug: tournament.slug,
          status: "results_imported",
          is_rated: tournament.isRated,
          in_card_stats: tournament.inCardStats,
        })
      : serviceClient
          .from("tournaments")
          .update({
            ...reported,
            ...(PRE_RESULTS_STATUSES.includes((existing as unknown as TournamentRow).status)
              ? { status: "results_imported" }
              : {}),
          })
          .eq("id", (existing as unknown as TournamentRow).id);

  const { data, error } = await write.select(TOURNAMENT_COLUMNS).single();
  if (error !== null) throw new Error(`saveSourcedTournament failed: ${error.message}`);
  return toTournament(data as unknown as TournamentRow);
}

/** One player's standing as an ingest computed it (E18.21). */
export interface NewTournamentEntry {
  readonly playerId: PlayerId;
  readonly placement: number | null;
  readonly matchWins: number;
  readonly matchLosses: number;
  readonly matchDraws: number;
  readonly gameWins: number;
  readonly gameLosses: number;
  readonly dropped: boolean;
}

/**
 * Make an event's standings exactly these (E18.21).
 *
 * Upserted on `(tournament_id, player_id)` rather than cleared and rewritten,
 * so an entry keeps its id and its deck across a re-ingest — a merge's undo
 * moves entries back by id (E18.16). Then whoever is no longer in the event is
 * removed.
 */
export async function replaceTournamentEntries(
  serviceClient: SupabaseClient,
  tournamentId: TournamentId,
  entries: readonly NewTournamentEntry[],
): Promise<void> {
  if (entries.length > 0) {
    const { error } = await serviceClient.from("tournament_entries").upsert(
      entries.map((entry) => ({
        tournament_id: tournamentId,
        player_id: entry.playerId,
        placement: entry.placement,
        match_wins: entry.matchWins,
        match_losses: entry.matchLosses,
        match_draws: entry.matchDraws,
        game_wins: entry.gameWins,
        game_losses: entry.gameLosses,
        dropped: entry.dropped,
      })),
      { onConflict: "tournament_id,player_id" },
    );
    if (error !== null) throw new Error(`replaceTournamentEntries failed: ${error.message}`);
  }

  let stale = serviceClient.from("tournament_entries").delete().eq("tournament_id", tournamentId);
  if (entries.length > 0) {
    stale = stale.not("player_id", "in", `(${entries.map((e) => e.playerId).join(",")})`);
  }
  const { error } = await stale;
  if (error !== null) throw new Error(`replaceTournamentEntries failed pruning: ${error.message}`);
}

/** A placed finisher, named for display. */
export interface TournamentFinisher {
  readonly placement: number;
  readonly playerId: PlayerId;
  readonly playerSlug: string | null;
  /** Null when the player is hidden from the public. */
  readonly displayName: string | null;
  readonly deckId: DeckId | null;
  readonly record: TournamentEntry["record"];
}

/** Everyone who finished at or above `through`, best first — a post's tournament card (E20.36). */
export async function listTournamentFinishers(
  client: SupabaseClient,
  tournamentId: TournamentId,
  through: number,
): Promise<readonly TournamentFinisher[]> {
  const { data, error } = await client
    .from("tournament_entries")
    .select(`${ENTRY_COLUMNS}, players (slug, display_name)`)
    .eq("tournament_id", tournamentId)
    .lte("placement", through)
    .order("placement", { ascending: true });

  if (error !== null) throw new Error(`listTournamentFinishers failed: ${error.message}`);
  return (data as unknown as FinisherRow[]).map((row) => {
    const entry = toTournamentEntry(row);
    return {
      placement: entry.placement ?? through,
      playerId: entry.playerId,
      playerSlug: row.players?.slug ?? null,
      displayName: row.players?.display_name ?? null,
      deckId: entry.deckId,
      record: entry.record,
    };
  });
}

interface FinisherRow extends TournamentEntryRow {
  readonly players: { readonly slug: string; readonly display_name: string } | null;
}

/** The newest events with results, for a picker. */
export async function listTournamentsWithResults(
  client: SupabaseClient,
  limit: number,
): Promise<readonly Tournament[]> {
  const { data, error } = await client
    .from("tournaments")
    .select(TOURNAMENT_COLUMNS)
    .in("status", IMPORTED_STATUSES)
    .order("event_date", { ascending: false })
    .order("slug", { ascending: true })
    .limit(limit);

  if (error !== null) throw new Error(`listTournamentsWithResults failed: ${error.message}`);
  return (data as unknown as TournamentRow[]).map(toTournament);
}

/** A tournament with the platform event it came from (E18.20). */
export interface SourcedTournamentRef {
  readonly tournament: Tournament;
  readonly source: string;
  readonly externalId: string;
}

/** The tournament a platform event became, or null before it is ingested. */
export async function getSourcedTournament(
  client: SupabaseClient,
  event: { readonly source: string; readonly externalId: string },
): Promise<Tournament | null> {
  const { data, error } = await client
    .from("tournaments")
    .select(TOURNAMENT_COLUMNS)
    .eq("source", event.source)
    .eq("external_id", event.externalId)
    .maybeSingle();

  if (error !== null) throw new Error(`getSourcedTournament failed: ${error.message}`);
  return data === null ? null : toTournament(data as unknown as TournamentRow);
}

/** Every tournament a platform sent, newest first — how `/admin/processing` finds its events' rows. */
export async function listSourcedTournaments(
  client: SupabaseClient,
): Promise<readonly SourcedTournamentRef[]> {
  const { data, error } = await client
    .from("tournaments")
    .select(`${TOURNAMENT_COLUMNS}, source, external_id`)
    .not("source", "is", null)
    .order("event_date", { ascending: false });

  if (error !== null) throw new Error(`listSourcedTournaments failed: ${error.message}`);
  return (data as unknown as (TournamentRow & { source: string; external_id: string })[]).map(
    (row) => ({ tournament: toTournament(row), source: row.source, externalId: row.external_id }),
  );
}

/** A tournament, what is stored of it, and what an admin has it count towards (E25). */
export interface TournamentCoverage {
  readonly tournament: Tournament;
  /** Null for an organiser's or a hand import. */
  readonly source: string | null;
  readonly externalId: string | null;
  /** The admin's choice. Differs from `tournament.isRated` while a recompute is waiting. */
  readonly includeInElo: boolean;
  readonly inCardStats: boolean;
  readonly matches: number;
  readonly entries: number;
  /** Entries with a deck. */
  readonly decks: number;
}

/**
 * Every tournament with its coverage, newest first — what `/admin/fetching`
 * reports as missing and `/admin/processing` decides over.
 */
export async function listTournamentCoverage(
  client: SupabaseClient,
): Promise<readonly TournamentCoverage[]> {
  const [tournaments, counts] = await Promise.all([
    client
      .from("tournaments")
      .select(`${TOURNAMENT_COLUMNS}, source, external_id, include_in_elo, in_card_stats`)
      .order("event_date", { ascending: false })
      .order("name"),
    client.from("tournament_coverage").select("id, match_count, entry_count, deck_count"),
  ]);
  if (tournaments.error !== null) {
    throw new Error(`listTournamentCoverage failed: ${tournaments.error.message}`);
  }
  if (counts.error !== null)
    throw new Error(`listTournamentCoverage failed: ${counts.error.message}`);

  const byId = new Map(
    (counts.data as unknown as CoverageRow[]).map((row) => [row.id, row] as const),
  );
  return (tournaments.data as unknown as InclusionRow[]).map((row) => {
    const count = byId.get(row.id);
    return {
      tournament: toTournament(row),
      source: row.source,
      externalId: row.external_id,
      includeInElo: row.include_in_elo,
      inCardStats: row.in_card_stats,
      matches: count?.match_count ?? 0,
      entries: count?.entry_count ?? 0,
      decks: count?.deck_count ?? 0,
    };
  });
}

interface InclusionRow extends TournamentRow {
  readonly source: string | null;
  readonly external_id: string | null;
  readonly include_in_elo: boolean;
  readonly in_card_stats: boolean;
}

interface CoverageRow {
  readonly id: string;
  readonly match_count: number;
  readonly entry_count: number;
  readonly deck_count: number;
}

/**
 * Choose what one tournament counts towards (E25.3). Elo is staged — the
 * ladder moves only when `applyEloInclusion` runs — and card statistics are
 * read directly. False when there is no such tournament.
 */
export async function setTournamentInclusion(
  serviceClient: SupabaseClient,
  tournamentId: TournamentId,
  inclusion: { readonly elo?: boolean; readonly cardStats?: boolean },
): Promise<boolean> {
  const { data, error } = await serviceClient
    .from("tournaments")
    .update({
      ...(inclusion.elo === undefined ? {} : { include_in_elo: inclusion.elo }),
      ...(inclusion.cardStats === undefined ? {} : { in_card_stats: inclusion.cardStats }),
    })
    .eq("id", tournamentId)
    .select("id");

  if (error !== null) throw new Error(`setTournamentInclusion failed: ${error.message}`);
  return data.length > 0;
}

/**
 * Put an event in a format version, and every deck the event made with it
 * (E25.8). A member's own saved deck that an entry names keeps its owner's
 * choice. Returns how many decks moved.
 */
export async function setTournamentFormat(
  serviceClient: SupabaseClient,
  tournamentId: TournamentId,
  formatVersionId: FormatVersionId,
): Promise<number> {
  const { data, error } = await serviceClient.rpc("set_tournament_format", {
    p_tournament_id: tournamentId,
    p_format_version_id: formatVersionId,
  });
  if (error !== null) throw new Error(`setTournamentFormat failed: ${error.message}`);
  return data as number;
}

/**
 * Make every staged Elo choice the ladder's: `is_rated` takes `include_in_elo`
 * wherever they differ. Returns how many tournaments changed, which the caller
 * follows with one full recompute (ADR 004).
 */
export async function applyEloInclusion(serviceClient: SupabaseClient): Promise<number> {
  let changed = 0;
  for (const rated of [true, false]) {
    const { data, error } = await serviceClient
      .from("tournaments")
      .update({ is_rated: rated })
      .eq("include_in_elo", rated)
      .eq("is_rated", !rated)
      .select("id");
    if (error !== null) throw new Error(`applyEloInclusion failed: ${error.message}`);
    changed += data.length;
  }
  return changed;
}

/** An entry with who played it: their name and every handle they hold. */
export interface NamedEntry extends TournamentEntry {
  /** Null when the player is hidden from the caller. */
  readonly displayName: string | null;
  readonly handles: readonly string[];
}

/** These events' entries, best first — what a decklist upload matches its names against (E20.37). */
export async function listNamedEntries(
  client: SupabaseClient,
  tournamentIds: readonly TournamentId[],
): Promise<readonly NamedEntry[]> {
  if (tournamentIds.length === 0) return [];
  const { data, error } = await client
    .from("tournament_entries")
    .select(`${ENTRY_COLUMNS}, players (display_name, player_identities (handle))`)
    .in("tournament_id", tournamentIds)
    .order("placement", { ascending: true, nullsFirst: false });

  if (error !== null) throw new Error(`listNamedEntries failed: ${error.message}`);
  return (data as unknown as NamedEntryRow[]).map((row) => ({
    ...toTournamentEntry(row),
    displayName: row.players?.display_name ?? null,
    handles: (row.players?.player_identities ?? []).map((identity) => identity.handle),
  }));
}

interface NamedEntryRow extends TournamentEntryRow {
  readonly players: {
    readonly display_name: string;
    readonly player_identities: readonly { readonly handle: string }[];
  } | null;
}

/** Point these entries at these decks — or at none — and leave the rest of the event alone. */
export async function setEntryDecks(
  serviceClient: SupabaseClient,
  tournamentId: TournamentId,
  links: readonly { readonly playerId: PlayerId; readonly deckId: DeckId | null }[],
): Promise<void> {
  for (const link of links) {
    const { error } = await serviceClient
      .from("tournament_entries")
      .update({ deck_id: link.deckId })
      .eq("tournament_id", tournamentId)
      .eq("player_id", link.playerId);
    if (error !== null) throw new Error(`setEntryDecks failed: ${error.message}`);
  }
}

/** One event somebody played, as a deck page or a member's list of events shows it. */
export interface PlayedEntry {
  readonly tournament: Pick<Tournament, "id" | "name" | "slug" | "eventDate" | "externalUrl">;
  readonly playerId: PlayerId;
  readonly deckId: DeckId | null;
  readonly placement: number | null;
  readonly record: TournamentEntry["record"];
}

/** The events a player entered, or that any of these decks was played at, newest first (E20.38). */
export async function listPlayedEntries(
  client: SupabaseClient,
  filter: { readonly playerId: PlayerId } | { readonly deckIds: readonly DeckId[] },
): Promise<readonly PlayedEntry[]> {
  let query = client
    .from("tournament_entries")
    .select(`${ENTRY_COLUMNS}, tournaments!inner (id, name, slug, event_date, external_url)`);
  query =
    "playerId" in filter
      ? query.eq("player_id", filter.playerId)
      : query.in("deck_id", filter.deckIds.length === 0 ? [NO_DECK] : filter.deckIds);

  const { data, error } = await query;
  if (error !== null) throw new Error(`listPlayedEntries failed: ${error.message}`);
  return (data as unknown as PlayedRow[])
    .map((row) => {
      const entry = toTournamentEntry(row);
      return {
        tournament: {
          id: row.tournaments.id as TournamentId,
          name: row.tournaments.name,
          slug: row.tournaments.slug,
          eventDate: row.tournaments.event_date,
          externalUrl: row.tournaments.external_url,
        },
        playerId: entry.playerId,
        deckId: entry.deckId,
        placement: entry.placement,
        record: entry.record,
      };
    })
    .sort((a, b) => b.tournament.eventDate.localeCompare(a.tournament.eventDate));
}

/** A uuid no deck has, so an empty `in` still parses. */
const NO_DECK = "00000000-0000-0000-0000-000000000000";

interface PlayedRow extends TournamentEntryRow {
  readonly tournaments: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly event_date: string;
    readonly external_url: string | null;
  };
}
