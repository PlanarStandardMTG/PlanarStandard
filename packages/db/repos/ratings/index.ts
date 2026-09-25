import type {
  LeaderboardRow,
  NewRatingRun,
  PlayerId,
  PlayerRating,
  RatingConfig,
  RatingEvent,
  RatingRun,
} from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CONFIG_COLUMNS,
  EVENT_COLUMNS,
  LEADERBOARD_COLUMNS,
  RATING_COLUMNS,
  RUN_COLUMNS,
  toLeaderboardRow,
  toPlayerRating,
  toRatingConfig,
  toRatingEvent,
  toRatingRun,
  type LeaderboardViewRow,
  type PlayerRatingRow,
  type RatingConfigRow,
  type RatingEventRow,
  type RatingRunRow,
} from "./rows";

/**
 * Reads and writes over the rating tables (E13.20).
 *
 * The reads take the public client and are covered by policies that follow the
 * player's visibility. The writes take the service-role client and there is
 * exactly one of them, because there is exactly one way ratings are produced: a
 * full replay, writing everything at once (ADR 004). Nothing here increments a
 * rating, and nothing here updates one player in isolation.
 */

/** The one config row. Throws if it is missing — nothing can rate without it. */
export async function getRatingConfig(client: SupabaseClient): Promise<RatingConfig> {
  const { data, error } = await client
    .from("rating_config")
    .select(CONFIG_COLUMNS)
    .eq("id", 1)
    .single();

  if (error !== null) throw new Error(`getRatingConfig failed: ${error.message}`);
  return toRatingConfig(data as unknown as RatingConfigRow);
}

/**
 * The leaderboard, highest first.
 *
 * Reads the **view**, not `player_ratings`. Who qualifies — public, unmerged,
 * past provisional, over the configured match threshold — is answered in one
 * place, and a caller filtering `player_ratings` by hand would be a second
 * answer that eventually disagrees with the first.
 */
export async function getLeaderboard(
  client: SupabaseClient,
  limit: number,
): Promise<readonly LeaderboardRow[]> {
  const { data, error } = await client
    .from("leaderboard")
    .select(LEADERBOARD_COLUMNS)
    // Ties break on slug, so two players on the same rating are in a stable
    // order rather than whichever the planner returned this time.
    .order("rating", { ascending: false })
    .order("slug", { ascending: true })
    .limit(limit);

  if (error !== null) throw new Error(`getLeaderboard failed: ${error.message}`);
  return (data as unknown as LeaderboardViewRow[]).map(toLeaderboardRow);
}

/**
 * Everyone rated who is not on the leaderboard yet, highest first — the page's
 * second table (E20.12).
 *
 * Reads the `provisional_ratings` view, which is `leaderboard`'s complement
 * with the same visibility rules, so a shown player is in exactly one of the two.
 */
export async function getProvisionalRatings(
  client: SupabaseClient,
  limit: number,
): Promise<readonly LeaderboardRow[]> {
  const { data, error } = await client
    .from("provisional_ratings")
    .select(LEADERBOARD_COLUMNS)
    .order("rating", { ascending: false })
    .order("slug", { ascending: true })
    .limit(limit);

  if (error !== null) throw new Error(`getProvisionalRatings failed: ${error.message}`);
  return (data as unknown as LeaderboardViewRow[]).map(toLeaderboardRow);
}

/**
 * One player's current standing, whether or not they are on the leaderboard.
 *
 * A provisional player has a rating and does not appear in the view; their own
 * page still shows it, labelled. Null when they have never played a rated match.
 */
export async function getPlayerRating(
  client: SupabaseClient,
  playerId: PlayerId,
): Promise<PlayerRating | null> {
  const { data, error } = await client
    .from("player_ratings")
    .select(RATING_COLUMNS)
    .eq("player_id", playerId)
    .maybeSingle();

  if (error !== null) throw new Error(`getPlayerRating failed: ${error.message}`);
  return data === null ? null : toPlayerRating(data as unknown as PlayerRatingRow);
}

/**
 * One player's rating history, oldest first — what `RatingHistory` plots (E19.12).
 *
 * This is the audit trail that makes a rating arguable rather than merely
 * asserted: every row says what the rating was, what it became, what was
 * expected, and which K applied.
 */
export async function listRatingHistory(
  client: SupabaseClient,
  playerId: PlayerId,
): Promise<readonly RatingEvent[]> {
  const { data, error } = await client
    .from("rating_events")
    .select(EVENT_COLUMNS)
    .eq("player_id", playerId)
    .order("event_date", { ascending: true })
    .order("match_number", { ascending: true });

  if (error !== null) throw new Error(`listRatingHistory failed: ${error.message}`);
  return (data as unknown as RatingEventRow[]).map(toRatingEvent);
}

/**
 * Replace every rating and every rating event with the output of one replay.
 *
 * The only write in this module, and deliberately the only shape a rating can be
 * produced in. ADR 004 says full recompute, never incremental, and this is that
 * rule expressed as an API: there is no function here that moves one player's
 * rating, because doing so would make the leaderboard depend on the order
 * somebody happened to call things in.
 *
 * **Not atomic.** PostgREST has no transaction across two tables, so there is a
 * window where the ratings are cleared. That window is acceptable here in a way
 * it would not be for the ledger: everything being deleted is derived, the
 * inputs are untouched, and a failed recompute is fixed by running it again. A
 * `plpgsql` function is the answer if the window ever needs to close.
 *
 * Events are deleted first and inserted last, so a reader mid-recompute sees
 * either the old history or no history, never one player's new events against
 * another's old rating.
 */
export async function replaceRatings(
  serviceClient: SupabaseClient,
  ratings: readonly PlayerRating[],
  events: readonly RatingEvent[],
): Promise<void> {
  const { error: clearEvents } = await serviceClient
    .from("rating_events")
    .delete()
    .not("id", "is", null);
  if (clearEvents !== null)
    throw new Error(`replaceRatings failed clearing events: ${clearEvents.message}`);

  const { error: clearRatings } = await serviceClient
    .from("player_ratings")
    .delete()
    .not("player_id", "is", null);
  if (clearRatings !== null)
    throw new Error(`replaceRatings failed clearing ratings: ${clearRatings.message}`);

  if (ratings.length > 0) {
    const { error } = await serviceClient.from("player_ratings").insert(
      ratings.map((rating) => ({
        player_id: rating.playerId,
        rating: rating.rating,
        peak_rating: rating.peakRating,
        matches_played: rating.matchesPlayed,
        wins: rating.wins,
        losses: rating.losses,
        draws: rating.draws,
        tournaments_played: rating.tournamentsPlayed,
        last_played: rating.lastPlayed,
        is_provisional: rating.isProvisional,
        is_active: rating.isActive,
      })),
    );
    if (error !== null) throw new Error(`replaceRatings failed writing ratings: ${error.message}`);
  }

  if (events.length > 0) {
    const { error } = await serviceClient.from("rating_events").insert(
      events.map((event) => ({
        player_id: event.playerId,
        match_id: event.matchId,
        tournament_id: event.tournamentId,
        opponent_id: event.opponentId,
        event_date: event.eventDate,
        rating_before: event.ratingBefore,
        rating_after: event.ratingAfter,
        expected_score: event.expectedScore,
        actual_score: event.actualScore,
        k_factor: event.kFactor,
        match_number: event.matchNumber,
      })),
    );
    if (error !== null) throw new Error(`replaceRatings failed writing events: ${error.message}`);
  }
}

/**
 * Log a recompute, anomalies and all.
 *
 * Written whether the run was clean or not — a run that found four self-play
 * anomalies and applied everything else is exactly the run somebody will want to
 * find later, and a log that only records the clean ones is a log of nothing
 * useful (E8.5).
 */
export async function recordRatingRun(
  serviceClient: SupabaseClient,
  run: NewRatingRun,
): Promise<RatingRun> {
  const { data, error } = await serviceClient
    .from("rating_runs")
    .insert({
      trigger: run.trigger,
      match_count: run.matchCount,
      player_count: run.playerCount,
      duration_ms: run.durationMs,
      anomalies: run.anomalies,
    })
    .select(RUN_COLUMNS)
    .single();

  if (error !== null) throw new Error(`recordRatingRun failed: ${error.message}`);
  return toRatingRun(data as unknown as RatingRunRow);
}

/** The most recent runs, newest first — the operator's view of recompute health. */
export async function listRatingRuns(
  serviceClient: SupabaseClient,
  limit: number,
): Promise<readonly RatingRun[]> {
  const { data, error } = await serviceClient
    .from("rating_runs")
    .select(RUN_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error !== null) throw new Error(`listRatingRuns failed: ${error.message}`);
  return (data as unknown as RatingRunRow[]).map(toRatingRun);
}
