import type { RunDetailsProblem, RunMoveRefusal } from "@ps/core";

/** What a refused run form or move means, in the site's voice. Codes come from `core/runs`. */
export const RUN_ERRORS: Readonly<Record<RunDetailsProblem | RunMoveRefusal, string>> = {
  "name-empty": "A run needs a name.",
  "name-long": "That name is too long.",
  "no-format": "Tick at least one format version.",
  "swiss-rounds": "Swiss rounds must be a whole number from 0 to 20.",
  "top-cut": "The top cut must be a whole number from 0 to 512.",
  "nothing-to-play": "With no Swiss rounds, the run needs a top cut of at least 2.",
  "not-a-move": "The run cannot move there from where it is.",
  "too-few-entrants": "At least two entrants must be checked in to start.",
  "has-swiss-rounds": "Play the Swiss rounds before the top cut.",
  "no-swiss-rounds": "This run has no Swiss rounds: start the top cut.",
  "no-top-cut": "This run has no top cut.",
  "has-top-cut": "Play the top cut before finishing.",
  "swiss-rounds-left": "There are Swiss rounds still to play.",
  "results-missing": "Some results are still to be confirmed.",
  "cut-unfinished": "The top cut has no champion yet.",
};

export const RUN_DONE: Readonly<Record<string, string>> = {
  saved: "Saved.",
  registration: "Registration is open.",
  cancelled: "The run is cancelled.",
};

export const STATE_LABEL: Readonly<Record<string, string>> = {
  draft: "Draft",
  registration: "Registration open",
  running: "Playing",
  top_cut: "Top cut",
  finished: "Finished",
  cancelled: "Cancelled",
};

export function messageFor(
  table: Readonly<Record<string, string>>,
  code: string | string[] | undefined,
): string | null {
  return typeof code === "string" ? (table[code] ?? null) : null;
}
