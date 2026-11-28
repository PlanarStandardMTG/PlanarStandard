import type { RunEntrantId, RunPairing, RunRecord } from "@ps/contracts";

import { isCounted } from "../record/index";

/** MTR Appendix C: no percentage below this, so one bad opponent cannot sink a tiebreaker. */
export const PERCENTAGE_FLOOR = 0.33;

export interface Tiebreakers {
  readonly opponentMatchWinPct: number;
  readonly gameWinPct: number;
  readonly opponentGameWinPct: number;
}

const floored = (points: number, possible: number): number =>
  possible === 0 ? PERCENTAGE_FLOOR : Math.max(PERCENTAGE_FLOOR, points / possible);

/** Match points over 3 × the rounds this entrant played, byes included (MTR Appendix C). */
export function matchWinPct(record: RunRecord): number {
  return floored(record.matchPoints, 3 * record.roundsPlayed);
}

/** Game points over 3 × the games this entrant played (MTR Appendix C). */
export function gameWinPct(record: RunRecord): number {
  return floored(record.gamePoints, 3 * record.gamesPlayed);
}

/** The mean of already-floored percentages; no opponents is the floor, not zero. */
export function opponentsAverage(percentages: readonly number[]): number {
  if (percentages.length === 0) return PERCENTAGE_FLOOR;
  return percentages.reduce((total, pct) => total + pct, 0) / percentages.length;
}

/** Who each entrant played in a counted pairing. Byes have no opponent and are skipped. */
export function opponentsOf(
  pairings: readonly RunPairing[],
): ReadonlyMap<RunEntrantId, readonly RunEntrantId[]> {
  const opponents = new Map<RunEntrantId, RunEntrantId[]>();
  const push = (id: RunEntrantId, opponent: RunEntrantId): void => {
    const list = opponents.get(id);
    if (list === undefined) opponents.set(id, [opponent]);
    else list.push(opponent);
  };
  for (const pairing of pairings) {
    if (pairing.p2EntrantId === null || !isCounted(pairing)) continue;
    push(pairing.p1EntrantId, pairing.p2EntrantId);
    push(pairing.p2EntrantId, pairing.p1EntrantId);
  }
  return opponents;
}

/**
 * The three tiebreakers after match points (MTR §3.1), at full precision: display
 * rounds them, comparison never does (§28).
 */
export function tiebreakers(
  records: ReadonlyMap<RunEntrantId, RunRecord>,
  pairings: readonly RunPairing[],
): ReadonlyMap<RunEntrantId, Tiebreakers> {
  const opponents = opponentsOf(pairings);
  const pctOf = (id: RunEntrantId, pct: (record: RunRecord) => number): number => {
    const record = records.get(id);
    return record === undefined ? PERCENTAGE_FLOOR : pct(record);
  };

  const result = new Map<RunEntrantId, Tiebreakers>();
  for (const [id, record] of records) {
    const faced = opponents.get(id) ?? [];
    result.set(id, {
      opponentMatchWinPct: opponentsAverage(faced.map((o) => pctOf(o, matchWinPct))),
      gameWinPct: gameWinPct(record),
      opponentGameWinPct: opponentsAverage(faced.map((o) => pctOf(o, gameWinPct))),
    });
  }
  return result;
}
