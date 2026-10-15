import type { Run, RunState } from "@ps/contracts";

/** What a move depends on, counted by the caller from the run's rows. */
export interface RunProgress {
  readonly checkedInEntrants: number;
  readonly swissRoundsPaired: number;
  /** Posted pairings, in any round, whose result is not yet confirmed. */
  readonly unconfirmedPairings: number;
  /** `core/runs/top-cut` has crowned a champion. */
  readonly cutFinished: boolean;
}

export type RunMoveRefusal =
  | "not-a-move"
  | "too-few-entrants"
  | "has-swiss-rounds"
  | "no-swiss-rounds"
  | "no-top-cut"
  | "has-top-cut"
  | "swiss-rounds-left"
  | "results-missing"
  | "cut-unfinished";

export type RunMove =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: RunMoveRefusal; readonly message: string };

const MOVES: Readonly<Record<RunState, readonly RunState[]>> = {
  draft: ["registration", "cancelled"],
  registration: ["running", "top_cut", "cancelled"],
  running: ["top_cut", "finished", "cancelled"],
  top_cut: ["finished", "cancelled"],
  finished: [],
  cancelled: [],
};

/** The states a run in `state` can move to, before checking what each needs. */
export function runMoves(state: RunState): readonly RunState[] {
  return MOVES[state];
}

const refuse = (reason: RunMoveRefusal, message: string): RunMove => ({
  ok: false,
  reason,
  message,
});
const OK: RunMove = { ok: true };

/** A cut of one is no cut: its only player is already the winner. */
const hasCut = (run: Pick<Run, "topCut">): boolean => run.topCut >= 2;

/**
 * Whether `run` may move to `to`, and if not, why (§28). A run with no Swiss rounds goes
 * from registration straight to the top cut; one with no cut finishes after its last
 * Swiss round. Cancelling is allowed until the run has finished.
 */
export function canMoveRun(
  run: Pick<Run, "state" | "swissRounds" | "topCut">,
  to: RunState,
  progress: RunProgress,
): RunMove {
  if (!MOVES[run.state].includes(to)) {
    return refuse("not-a-move", `A run in ${run.state} cannot move to ${to}.`);
  }
  if (to === "cancelled" || to === "registration") return OK;

  const resultsIn =
    progress.unconfirmedPairings === 0
      ? OK
      : refuse("results-missing", `${progress.unconfirmedPairings} result(s) still to confirm.`);

  if (run.state === "registration") {
    if (progress.checkedInEntrants < 2) {
      return refuse("too-few-entrants", "At least two entrants must be checked in to start.");
    }
    if (to === "running" && run.swissRounds === 0) {
      return refuse("no-swiss-rounds", "This run has no Swiss rounds: start the top cut.");
    }
    if (to === "top_cut" && run.swissRounds > 0) {
      return refuse("has-swiss-rounds", "Play the Swiss rounds before the top cut.");
    }
    if (to === "top_cut" && !hasCut(run)) {
      return refuse("no-top-cut", "This run has neither Swiss rounds nor a top cut.");
    }
    return OK;
  }

  if (run.state === "running") {
    if (progress.swissRoundsPaired < run.swissRounds) {
      const left = run.swissRounds - progress.swissRoundsPaired;
      return refuse("swiss-rounds-left", `${left} Swiss round(s) still to play.`);
    }
    if (to === "top_cut" && !hasCut(run)) {
      return refuse("no-top-cut", "This run has no top cut: finish it instead.");
    }
    if (to === "finished" && hasCut(run)) {
      return refuse("has-top-cut", "Play the top cut before finishing.");
    }
    return resultsIn;
  }

  if (!progress.cutFinished) {
    return refuse("cut-unfinished", "The top cut has no champion yet.");
  }
  return resultsIn;
}
