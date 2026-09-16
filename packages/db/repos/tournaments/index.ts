import type { SeasonId, Tournament, TournamentEntry, TournamentId } from "@ps/contracts";
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
