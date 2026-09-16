import type {
  LeaderboardRow,
  MatchId,
  PlayerId,
  RatingAnomaly,
  RatingConfig,
  RatingEvent,
  RatingRun,
  RatingRunId,
  PlayerRating,
  TournamentId,
} from "@ps/contracts";

/**
 * The rating tables as PostgREST returns them. Kept next to the mappers: outside
 * this module these are contract types, and the snake_case shape of the tables
 * is nobody else's business.
 *
 * Every numeric column below is typed `number | string`. PostgREST returns
 * `numeric` as a JSON number until the value is wide enough to need a string,
 * and a rating that arrives as `"1712.5"` sorts as text and renders as text
 * without ever throwing. `toNumber` is not defensive tidying — it is the reason
 * a leaderboard cannot silently order itself alphabetically.
 */
export interface RatingConfigRow {
  readonly initial_rating: number;
  readonly k_provisional: number;
  readonly k_standard: number;
  readonly k_elite: number;
  readonly provisional_matches: number;
  readonly elite_threshold: number;
  readonly min_matches_for_leaderboard: number;
  readonly inactive_after_days: number;
  readonly count_byes: boolean;
  readonly count_elimination_rounds: boolean;
}

export interface PlayerRatingRow {
  readonly player_id: string;
  readonly rating: number | string;
  readonly peak_rating: number | string;
  readonly matches_played: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly tournaments_played: number;
  readonly last_played: string | null;
  readonly is_provisional: boolean;
  readonly is_active: boolean;
}

export interface RatingEventRow {
  readonly player_id: string;
  readonly match_id: string;
  readonly tournament_id: string;
  readonly opponent_id: string | null;
  readonly event_date: string;
  readonly rating_before: number | string;
  readonly rating_after: number | string;
  readonly expected_score: number | string;
  readonly actual_score: number | string;
  readonly k_factor: number | string;
  readonly match_number: number;
}

export interface LeaderboardViewRow {
  readonly id: string;
  readonly slug: string;
  readonly display_name: string;
  readonly rating: number | string;
  readonly peak_rating: number | string;
  readonly matches_played: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly tournaments_played: number;
  readonly last_played: string | null;
  readonly is_active: boolean;
}

export interface RatingRunRow {
  readonly id: string;
  readonly trigger: string;
  readonly match_count: number | null;
  readonly player_count: number | null;
  readonly duration_ms: number | null;
  readonly anomalies: unknown;
  readonly created_at: string;
}

export const CONFIG_COLUMNS =
  "initial_rating, k_provisional, k_standard, k_elite, provisional_matches, elite_threshold, " +
  "min_matches_for_leaderboard, inactive_after_days, count_byes, count_elimination_rounds";

export const RATING_COLUMNS =
  "player_id, rating, peak_rating, matches_played, wins, losses, draws, tournaments_played, " +
  "last_played, is_provisional, is_active";

export const EVENT_COLUMNS =
  "player_id, match_id, tournament_id, opponent_id, event_date, rating_before, rating_after, " +
  "expected_score, actual_score, k_factor, match_number";

export const LEADERBOARD_COLUMNS =
  "id, slug, display_name, rating, peak_rating, matches_played, wins, losses, draws, " +
  "tournaments_played, last_played, is_active";

export const RUN_COLUMNS =
  "id, trigger, match_count, player_count, duration_ms, anomalies, created_at";

export function toRatingConfig(row: RatingConfigRow): RatingConfig {
  return {
    initialRating: row.initial_rating,
    kProvisional: row.k_provisional,
    kStandard: row.k_standard,
    kElite: row.k_elite,
    provisionalMatches: row.provisional_matches,
    eliteThreshold: row.elite_threshold,
    minMatchesForLeaderboard: row.min_matches_for_leaderboard,
    inactiveAfterDays: row.inactive_after_days,
    countByes: row.count_byes,
    countEliminationRounds: row.count_elimination_rounds,
  };
}

export function toPlayerRating(row: PlayerRatingRow): PlayerRating {
  return {
    playerId: row.player_id as PlayerId,
    rating: Number(row.rating),
    peakRating: Number(row.peak_rating),
    matchesPlayed: row.matches_played,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    tournamentsPlayed: row.tournaments_played,
    lastPlayed: row.last_played,
    isProvisional: row.is_provisional,
    isActive: row.is_active,
  };
}

export function toRatingEvent(row: RatingEventRow): RatingEvent {
  return {
    playerId: row.player_id as PlayerId,
    matchId: row.match_id as MatchId,
    tournamentId: row.tournament_id as TournamentId,
    opponentId: row.opponent_id as PlayerId | null,
    eventDate: row.event_date,
    ratingBefore: Number(row.rating_before),
    ratingAfter: Number(row.rating_after),
    expectedScore: Number(row.expected_score),
    actualScore: Number(row.actual_score),
    kFactor: Number(row.k_factor),
    matchNumber: row.match_number,
  };
}

export function toLeaderboardRow(row: LeaderboardViewRow): LeaderboardRow {
  return {
    id: row.id as PlayerId,
    slug: row.slug,
    displayName: row.display_name,
    rating: Number(row.rating),
    peakRating: Number(row.peak_rating),
    matchesPlayed: row.matches_played,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    tournamentsPlayed: row.tournaments_played,
    lastPlayed: row.last_played,
    isActive: row.is_active,
  };
}

export function toRatingRun(row: RatingRunRow): RatingRun {
  return {
    id: row.id as RatingRunId,
    trigger: row.trigger,
    matchCount: row.match_count,
    playerCount: row.player_count,
    durationMs: row.duration_ms,
    anomalies: (row.anomalies ?? []) as readonly RatingAnomaly[],
    createdAt: row.created_at,
  };
}
