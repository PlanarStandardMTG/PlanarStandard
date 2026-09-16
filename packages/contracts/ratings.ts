// Ratings are derived from the ledger, so the ledger owns the ids and the result
// vocabulary; `core/elo` only adds the numbers.
import type { IsoDate, MatchId, PlayerId, TournamentId } from "./primitives";
import type { MatchResult } from "./results";

/**
 * The singleton `rating_config` row (§12). Every threshold and every K that
 * `core/elo` needs is reachable from here; none of them is hard-coded (E8.2).
 */
export interface RatingConfig {
  readonly initialRating: number;
  readonly kProvisional: number;
  readonly kStandard: number;
  readonly kElite: number;
  /** Rated matches a player must play before leaving provisional K (E8.6). */
  readonly provisionalMatches: number;
  /** The rating that separates standard K from elite K. */
  readonly eliteThreshold: number;
  readonly minMatchesForLeaderboard: number;
  /** Days without a rated match before `isActive` goes false (E8.6). */
  readonly inactiveAfterDays: number;
  readonly countByes: boolean;
  readonly countEliminationRounds: boolean;
}

/**
 * One `matches` row as `core/elo/replay` consumes it.
 *
 * The ledger stores `p1_identity_id` / `p2_identity_id` — handles, not people
 * (ADR 003). Resolution to a player happens at read time, in the repository
 * layer, before this type is constructed; that is why the fields below name
 * players and why a merge changes ratings without touching a ledger row.
 */
export interface LedgerMatch {
  readonly matchId: MatchId;
  readonly tournamentId: TournamentId;
  readonly eventDate: IsoDate;
  /** `tournaments.weight`, a multiplier on K. Flat 1.0 today (Part IX, 7). */
  readonly tournamentWeight: number;
  /** Ordering within a tournament; replay sorts by date, round, then matchId. */
  readonly round: number;
  readonly p1PlayerId: PlayerId;
  /** Null on a bye — there is no opponent to resolve. */
  readonly p2PlayerId: PlayerId | null;
  readonly p1Games: number;
  readonly p2Games: number;
  readonly gameDraws: number;
  readonly result: MatchResult;
  readonly isElimination: boolean;
}

/**
 * One `rating_events` row: the per-player, per-match audit trail replay emits.
 * No `id` — Postgres assigns one on insert, and core never sees it.
 */
export interface RatingEvent {
  readonly playerId: PlayerId;
  readonly matchId: MatchId;
  readonly tournamentId: TournamentId;
  readonly opponentId: PlayerId | null;
  readonly eventDate: IsoDate;
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  readonly expectedScore: number;
  readonly actualScore: number;
  /** Already multiplied by the tournament weight (E8.2). */
  readonly kFactor: number;
  /** This player's nth rated match, from 1 — what `pick-k` compares against
   * `provisionalMatches`. */
  readonly matchNumber: number;
}

/** One `player_ratings` row. Flags and counters are derived by replay (E8.6). */
export interface PlayerRating {
  readonly playerId: PlayerId;
  readonly rating: number;
  readonly peakRating: number;
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly tournamentsPlayed: number;
  /** Null until a rated match lands, so `isActive` has nothing to measure. */
  readonly lastPlayed: IsoDate | null;
  readonly isProvisional: boolean;
  readonly isActive: boolean;
}

export type RatingAnomalyKind =
  "self-play" | "duplicate-match-id" | "impossible-game-count" | "rating-jump";

/**
 * Anomalies are stored in `rating_runs.anomalies` (jsonb), so every member is
 * a plain JSON value: no dates, no undefined, nothing to serialize.
 */
interface RatingAnomalyBase {
  readonly kind: RatingAnomalyKind;
  readonly matchId: MatchId;
  readonly tournamentId: TournamentId;
  /** Shown verbatim in the rating-run log. */
  readonly detail: string;
}

/** Both sides resolved to the same player; the match is skipped, not applied. */
export interface SelfPlayAnomaly extends RatingAnomalyBase {
  readonly kind: "self-play";
  readonly playerId: PlayerId;
}

/** A match id appeared twice in the stream; the repeat is skipped. */
export interface DuplicateMatchAnomaly extends RatingAnomalyBase {
  readonly kind: "duplicate-match-id";
  /** 0-based position of the repeat in the input stream. */
  readonly streamIndex: number;
}

/** Game counts no best-of-three could produce. */
export interface ImpossibleGameCountAnomaly extends RatingAnomalyBase {
  readonly kind: "impossible-game-count";
  readonly p1Games: number;
  readonly p2Games: number;
  readonly gameDraws: number;
  readonly result: MatchResult;
}

/** A single match moved a rating further than any K in the config allows. */
export interface RatingJumpAnomaly extends RatingAnomalyBase {
  readonly kind: "rating-jump";
  readonly playerId: PlayerId;
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  /** The bound that was exceeded, recorded because the config is admin-edited
   * and a past run has to stay readable after it changes. */
  readonly bound: number;
}

export type RatingAnomaly =
  SelfPlayAnomaly | DuplicateMatchAnomaly | ImpossibleGameCountAnomaly | RatingJumpAnomaly;

/** What `core/elo/replay` returns. Anomalies come back as data; replay does
 * not throw (E8.5). */
export interface ReplayResult {
  readonly ratings: readonly PlayerRating[];
  /** In application order — the rows written to `rating_events`. */
  readonly events: readonly RatingEvent[];
  readonly anomalies: readonly RatingAnomaly[];
  /** Matches that actually moved a rating; byes and skipped rows are not
   * counted. Feeds `rating_runs.match_count` (E18.12). */
  readonly matchesApplied: number;
}
