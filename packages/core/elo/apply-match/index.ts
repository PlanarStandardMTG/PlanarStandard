import type { MatchResult, PlayerId, RatingConfig } from "@ps/contracts";

import { expectedScore } from "../expected-score/index";
import { pickK } from "../pick-k/index";

/** One player as they stood before the match. */
export interface PlayerSnapshot {
  readonly playerId: PlayerId;
  readonly rating: number;
  readonly matchesPlayed: number;
}

/** What one match did to one player. Mirrors a `rating_events` row minus its keys. */
export interface SideUpdate {
  readonly playerId: PlayerId;
  readonly opponentId: PlayerId | null;
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  readonly expectedScore: number;
  readonly actualScore: number;
  readonly kFactor: number;
}

export interface MatchUpdate {
  readonly p1: SideUpdate;
  readonly p2: SideUpdate;
}

/** Why a match carried no rating information. Returned as data — replay records it. */
export type SkipReason = "bye" | "no-opponent" | "elimination-excluded";

export type ApplyResult =
  | { readonly applied: true; readonly update: MatchUpdate }
  | { readonly applied: false; readonly reason: SkipReason };

/** What each side scored. `null` where the result is not a contest between two players. */
function scoresFor(result: MatchResult): readonly [number, number] | null {
  switch (result) {
    case "p1_win":
      return [1, 0];
    case "p2_win":
      return [0, 1];
    case "draw":
      return [0.5, 0.5];
    // Both players are penalised as if they lost; neither gains.
    case "double_loss":
      return [0, 0];
    case "bye":
      return null;
  }
}

export interface ApplyMatchInput {
  readonly result: MatchResult;
  readonly isElimination: boolean;
  /** `tournaments.weight` — a multiplier on both K factors. */
  readonly tournamentWeight: number;
}

/**
 * Applies one match to two players.
 *
 * Both updates are computed from the **pre-match** ratings before either is
 * written, so the order the two sides are processed in cannot change the result.
 * That is the property the whole ledger rests on: replay must be a pure function
 * of the match stream, not of iteration order.
 */
export function applyMatch(
  match: ApplyMatchInput,
  p1: PlayerSnapshot,
  p2: PlayerSnapshot | null,
  config: RatingConfig,
): ApplyResult {
  // A bye carries no rating information whatever the config says: there is no
  // opponent to be right or wrong about. `countByes` governs whether replay counts
  // it as an appearance, which is a different question.
  if (match.result === "bye") return { applied: false, reason: "bye" };
  if (p2 === null) return { applied: false, reason: "no-opponent" };
  if (match.isElimination && !config.countEliminationRounds) {
    return { applied: false, reason: "elimination-excluded" };
  }

  const scores = scoresFor(match.result);
  if (scores === null) return { applied: false, reason: "bye" };
  const [p1Score, p2Score] = scores;

  // Read everything off the snapshots first; nothing below reads a written value.
  const p1Expected = expectedScore(p1.rating, p2.rating);
  const p2Expected = expectedScore(p2.rating, p1.rating);
  const p1K = pickK(p1, config, match.tournamentWeight);
  const p2K = pickK(p2, config, match.tournamentWeight);

  return {
    applied: true,
    update: {
      p1: {
        playerId: p1.playerId,
        opponentId: p2.playerId,
        ratingBefore: p1.rating,
        ratingAfter: p1.rating + p1K * (p1Score - p1Expected),
        expectedScore: p1Expected,
        actualScore: p1Score,
        kFactor: p1K,
      },
      p2: {
        playerId: p2.playerId,
        opponentId: p1.playerId,
        ratingBefore: p2.rating,
        ratingAfter: p2.rating + p2K * (p2Score - p2Expected),
        expectedScore: p2Expected,
        actualScore: p2Score,
        kFactor: p2K,
      },
    },
  };
}
