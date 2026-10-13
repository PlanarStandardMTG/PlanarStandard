import type { RunEntrant, RunPairing, RunRound, RunStructure } from "@ps/contracts";

import type { RunProgress } from "../run-state/index";
import { runStandings } from "../standings/index";
import { cutSeeds, nextCutRound } from "../top-cut/index";

export interface RunProgressInput {
  readonly run: RunStructure & { readonly seed: string };
  readonly entrants: readonly RunEntrant[];
  readonly rounds: readonly RunRound[];
  readonly pairings: readonly RunPairing[];
}

export interface RunPosition extends RunProgress {
  /** The number the next round would take, Swiss or cut. */
  readonly nextRound: number;
  readonly swissPairings: readonly RunPairing[];
  readonly cutPairings: readonly RunPairing[];
}

/**
 * Where a run is, counted from its rows: what `run-state` needs to judge a move, and
 * what the next round would be numbered. Pure, so a page and an action count alike.
 */
export function runProgress({ run, entrants, rounds, pairings }: RunProgressInput): RunPosition {
  const kindOf = new Map(rounds.map((r) => [r.number, r.kind]));
  const swissPairings = pairings.filter((p) => kindOf.get(p.round) === "swiss");
  const cutPairings = pairings.filter((p) => kindOf.get(p.round) === "elimination");
  const lastRound = Math.max(0, ...rounds.map((r) => r.number));

  let cutFinished = false;
  if (cutPairings.length > 0) {
    const seeds = cutSeeds(
      runStandings({ entrants, pairings: swissPairings, seed: run.seed }),
      run.topCut,
    );
    cutFinished =
      nextCutRound({ seeds, entrants, pairings: cutPairings, round: lastRound + 1 }).kind ===
      "finished";
  }

  return {
    checkedInEntrants: entrants.filter((e) => e.checkedIn && e.droppedAfterRound !== 0).length,
    swissRoundsPaired: rounds.filter((r) => r.kind === "swiss").length,
    unconfirmedPairings: pairings.filter((p) => p.status !== "confirmed").length,
    cutFinished,
    nextRound: lastRound + 1,
    swissPairings,
    cutPairings,
  };
}
