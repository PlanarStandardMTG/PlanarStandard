import type {
  DeckId,
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
  /** Used only when the row is new: after that, `is_rated` is an admin's call (E20.34). */
  readonly isRated: boolean;
}

/** Statuses an ingest moves on to `results_imported`. Verified or archived is a person's call, and stays. */
const PRE_RESULTS_STATUSES: readonly TournamentStatus[] = ["draft", "awaiting_results"];

/**
 * Create or refresh the tournament a platform event became.
 *
 * Found by `(source, external_id)`, so ingesting an event twice updates one row.
 * A refresh rewrites what the platform knows — name, date, season, shape — and
 * leaves what people decided alone: the slug, `is_rated`, and a status past
 * `results_imported`. A new row fails on a taken slug; the caller retries with
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
          is_rated: tournament.isRated,
          status: "results_imported",
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
