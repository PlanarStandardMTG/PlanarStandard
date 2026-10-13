import type {
  ProposedRunPairing,
  RunEntrant,
  RunEntrantId,
  RunPairing,
  RunStanding,
} from "@ps/contracts";

import { countedGames } from "../record/index";

/**
 * Who makes the cut, best seed first: the top `topCut` of the final Swiss standings who
 * have not dropped. With no Swiss rounds the standings are the seed's order, so the
 * bracket is seeded at random.
 */
export function cutSeeds(standings: readonly RunStanding[], topCut: number): RunEntrantId[] {
  return standings
    .filter((s) => !s.dropped)
    .slice(0, Math.max(0, topCut))
    .map((s) => s.entrantId);
}

/**
 * Seed numbers in bracket order for a power-of-two bracket: `[1, 8, 4, 5, 2, 7, 3, 6]`
 * for eight, so 1 v 8 and 4 v 5 feed one semifinal (MTR §10.4).
 */
export function bracketOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next = order.length * 2;
    order = order.flatMap((seed) => [seed, next + 1 - seed]);
  }
  return order;
}

export interface CutRoundInput {
  /** From `cutSeeds`: index 0 is seed 1. */
  readonly seeds: readonly RunEntrantId[];
  readonly entrants: readonly RunEntrant[];
  /** The top cut's pairings so far, every round of them. */
  readonly pairings: readonly RunPairing[];
  /** The run-wide number of the round being paired. */
  readonly round: number;
}

export type CutRound =
  | { readonly kind: "pairings"; readonly pairings: readonly ProposedRunPairing[] }
  | { readonly kind: "finished"; readonly champion: RunEntrantId | null }
  | { readonly kind: "results-missing" };

/** The winner of a counted cut pairing; null while unreported, or drawn — the cut has no draws (MTR §2.4). */
function winnerOf(pairing: RunPairing): RunEntrantId | null {
  const games = countedGames(pairing);
  if (games === null || games.p1Wins === games.p2Wins) return null;
  return games.p1Wins > games.p2Wins ? pairing.p1EntrantId : pairing.p2EntrantId;
}

/**
 * The cut's next round. Each round pairs the survivors within bracket blocks that double
 * each round, so the bracket plays out as seeded and a short one gives its top seeds byes.
 * When a drop leaves someone without an opponent, nobody is advanced to replace them;
 * the highest-ranked remaining player gets the bye instead (MTR §2.10), and everyone left
 * loose is paired best seed against worst.
 */
export function nextCutRound({ seeds, entrants, pairings, round }: CutRoundInput): CutRound {
  const losers = new Set<RunEntrantId>();
  for (const pairing of pairings) {
    if (pairing.p2EntrantId === null) continue;
    const winner = winnerOf(pairing);
    if (winner === null) return { kind: "results-missing" };
    losers.add(winner === pairing.p1EntrantId ? pairing.p2EntrantId : pairing.p1EntrantId);
  }

  const droppedBefore = new Set(
    entrants
      .filter((e) => e.droppedAfterRound !== null && e.droppedAfterRound < round)
      .map((e) => e.id),
  );
  const seedOf = new Map(seeds.map((id, i) => [id, i + 1]));
  const survivors = seeds.filter((id) => !losers.has(id) && !droppedBefore.has(id));
  if (survivors.length <= 1) return { kind: "finished", champion: survivors[0] ?? null };

  const bracketSize = bracketOrder(seeds.length).length;
  const position = new Map(bracketOrder(bracketSize).map((seed, i) => [seed, i]));
  const cutRound = new Set(pairings.map((p) => p.round)).size + 1;
  const blockSize = 2 ** cutRound;
  const blockOf = (id: RunEntrantId): number =>
    Math.floor((position.get(seedOf.get(id) ?? 0) ?? 0) / blockSize);
  const bySeed = (a: RunEntrantId, b: RunEntrantId): number =>
    (seedOf.get(a) ?? 0) - (seedOf.get(b) ?? 0);

  const blocks = new Map<number, RunEntrantId[]>();
  for (const id of survivors) {
    const block = blocks.get(blockOf(id)) ?? [];
    block.push(id);
    blocks.set(blockOf(id), block);
  }

  /** A block's lone player has a bye by design when the other half never held a seed. */
  const byDesign = (id: RunEntrantId): boolean => {
    const half = blockSize / 2;
    const start = blockOf(id) * blockSize;
    const ownHalf = Math.floor(((position.get(seedOf.get(id) ?? 0) ?? 0) - start) / half);
    const otherStart = start + (1 - ownHalf) * half;
    return bracketOrder(bracketSize)
      .slice(otherStart, otherStart + half)
      .every((seed) => seed > seeds.length);
  };

  const matches: Array<[RunEntrantId, RunEntrantId]> = [];
  const byes: RunEntrantId[] = [];
  const loose: RunEntrantId[] = [];
  for (const block of [...blocks.entries()].sort(([a], [b]) => a - b).map(([, ids]) => ids)) {
    const [first, second] = [...block].sort(bySeed);
    if (block.length === 2 && first !== undefined && second !== undefined) {
      matches.push([first, second]);
    } else if (block.length === 1 && first !== undefined && byDesign(first)) {
      byes.push(first);
    } else {
      loose.push(...block);
    }
  }

  if (loose.length % 2 === 1) {
    const top = survivors.filter((id) => !byes.includes(id)).sort(bySeed)[0];
    if (top !== undefined) {
      byes.push(top);
      const inLoose = loose.indexOf(top);
      if (inLoose >= 0) {
        loose.splice(inLoose, 1);
      } else {
        const match = matches.findIndex(([a]) => a === top);
        const [dissolved] = matches.splice(match, 1);
        if (dissolved !== undefined) loose.push(dissolved[1]);
      }
    }
  }
  loose.sort(bySeed);
  while (loose.length >= 2) {
    const best = loose.shift();
    const worst = loose.pop();
    if (best !== undefined && worst !== undefined) matches.push([best, worst]);
  }

  const proposed: ProposedRunPairing[] = matches.map(([p1, p2], i) => ({
    table: i + 1,
    p1EntrantId: p1,
    p2EntrantId: p2,
  }));
  byes.sort(bySeed).forEach((id, i) => {
    proposed.push({ table: matches.length + i + 1, p1EntrantId: id, p2EntrantId: null });
  });
  return { kind: "pairings", pairings: proposed };
}
