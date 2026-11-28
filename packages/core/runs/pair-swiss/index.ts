import type { ProposedRunPairing, RunEntrant, RunEntrantId, RunPairing } from "@ps/contracts";

import { byeCandidates } from "../assign-bye/index";
import { seededRandom } from "../seeded-random/index";
import { runStandings } from "../standings/index";

export interface PairSwissInput {
  readonly entrants: readonly RunEntrant[];
  /** Every Swiss pairing posted before this round, reported or not. */
  readonly pairings: readonly RunPairing[];
  readonly seed: string;
  /** The round being paired, from 1. */
  readonly round: number;
}

export type PairSwissResult =
  | { readonly ok: true; readonly pairings: readonly ProposedRunPairing[] }
  | { readonly ok: false; readonly reason: "too-few-entrants" | "no-pairing-without-rematch" };

/**
 * How many partial pairings the search may try before giving up. Far beyond what a
 * pairable round needs, which the greedy first branch almost always finds; it exists so
 * an unpairable one — more rounds than the field allows — answers in milliseconds.
 */
const SEARCH_BUDGET = 200_000;

/** Paired in round `round`: checked in, and had not dropped before it was paired (MTR §2.10). */
export function isPairable(entrant: RunEntrant, round: number): boolean {
  return (
    entrant.checkedIn && (entrant.droppedAfterRound === null || entrant.droppedAfterRound >= round)
  );
}

const pairKey = (a: RunEntrantId, b: RunEntrantId): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Pairs `order` top down: each unpaired player takes the highest-placed opponent they
 * have not played, backtracking when that strands someone further down. Pairing down
 * from an odd point group falls out of this, because the order runs across groups.
 */
function pairUp(
  order: readonly RunEntrantId[],
  played: ReadonlySet<string>,
  budget: { left: number },
): Array<[RunEntrantId, RunEntrantId]> | null {
  const used = new Set<RunEntrantId>();
  const pairs: Array<[RunEntrantId, RunEntrantId]> = [];

  const step = (): boolean => {
    budget.left -= 1;
    if (budget.left < 0) return false;
    const first = order.find((id) => !used.has(id));
    if (first === undefined) return true;
    used.add(first);
    for (const other of order) {
      if (used.has(other) || played.has(pairKey(first, other))) continue;
      used.add(other);
      pairs.push([first, other]);
      if (step()) return true;
      pairs.pop();
      used.delete(other);
    }
    used.delete(first);
    return false;
  };

  return step() ? pairs : null;
}

/**
 * The next Swiss round, by common practice — MTR §10.4 names Swiss without defining it
 * (§28). Players are ordered by match points, shuffled within each point group by the
 * run's seed (round 1 is one big group, so fully random), then paired top down with no
 * rematch. With an odd count, the bye goes to the lowest-ranked player without one,
 * moving up the list only if that choice leaves no legal pairing. Same input, same seed:
 * same pairings.
 */
export function pairSwiss({ entrants, pairings, seed, round }: PairSwissInput): PairSwissResult {
  const pairable = entrants.filter((entrant) => isPairable(entrant, round));
  if (pairable.length < 2) return { ok: false, reason: "too-few-entrants" };

  const standings = runStandings({ entrants, pairings, seed });
  const points = new Map(standings.map((s) => [s.entrantId, s.matchPoints]));
  const shuffleKey = new Map(
    pairable.map((e) => [e.id, seededRandom(`${seed}:round:${round}:${e.id}`)()]),
  );
  const order = pairable
    .map((e) => e.id)
    .sort(
      (a, b) =>
        (points.get(b) ?? 0) - (points.get(a) ?? 0) ||
        (shuffleKey.get(a) ?? 0) - (shuffleKey.get(b) ?? 0),
    );

  const played = new Set(
    pairings.flatMap((p) =>
      p.p2EntrantId === null ? [] : [pairKey(p.p1EntrantId, p.p2EntrantId)],
    ),
  );
  const budget = { left: SEARCH_BUDGET };

  const byeOptions: Array<RunEntrantId | null> =
    order.length % 2 === 0 ? [null] : byeCandidates(standings, new Set(order));
  for (const bye of byeOptions) {
    const pairs = pairUp(
      order.filter((id) => id !== bye),
      played,
      budget,
    );
    if (pairs === null) {
      if (budget.left < 0) break;
      continue;
    }
    const proposed: ProposedRunPairing[] = pairs.map(([p1, p2], i) => ({
      table: i + 1,
      p1EntrantId: p1,
      p2EntrantId: p2,
    }));
    if (bye !== null)
      proposed.push({ table: pairs.length + 1, p1EntrantId: bye, p2EntrantId: null });
    return { ok: true, pairings: proposed };
  }
  return { ok: false, reason: "no-pairing-without-rematch" };
}
