import type { RunPairing, RunRound } from "@ps/contracts";

import { bracketOrder } from "../top-cut/index";

const FROM_THE_END = ["Finals", "Semifinals", "Quarterfinals"] as const;

/**
 * What each round is called (E26.34): `Round 3` in Swiss, and in the top cut the last
 * three by name — Quarterfinals, Semifinals, Finals — counted back from the final of a
 * bracket sized by who started the cut. A cut longer than three rounds (more than eight
 * players) opens with `Round N` again.
 */
export function roundTitles(
  rounds: readonly RunRound[],
  pairings: readonly RunPairing[],
): ReadonlyMap<number, string> {
  const cut = rounds.filter((r) => r.kind === "elimination").sort((a, b) => a.number - b.number);
  const first = cut[0];
  const seeded = new Set(
    pairings
      .filter((p) => first !== undefined && p.round === first.number)
      .flatMap((p) => (p.p2EntrantId === null ? [p.p1EntrantId] : [p.p1EntrantId, p.p2EntrantId])),
  );
  const cutRounds = seeded.size < 2 ? cut.length : Math.log2(bracketOrder(seeded.size).length);

  return new Map(
    rounds.map((round) => {
      const index = cut.indexOf(round);
      const title = index < 0 ? undefined : FROM_THE_END[cutRounds - 1 - index];
      return [round.number, title ?? `Round ${round.number}`];
    }),
  );
}
