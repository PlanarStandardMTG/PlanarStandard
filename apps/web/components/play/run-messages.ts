import type { RunDetailsProblem, RunMoveRefusal } from "@ps/core";

/** Refusals the run page's own actions raise, beside core's. */
type RunPageProblem =
  | "no-handle"
  | "registration-closed"
  | "deck-empty"
  | "deck-long"
  | "deck-unreadable"
  | "deck-locked"
  | "handle-clash"
  | "already-registered"
  | "not-withdrawable";

/** What a refused run form or move means, in the site's voice. Codes come from `core/runs`. */
export const RUN_ERRORS: Readonly<
  Record<RunDetailsProblem | RunMoveRefusal | RunPageProblem, string>
> = {
  "no-handle": "Set a handle on your profile first: your matches are recorded under it.",
  "registration-closed": "Registration is not open.",
  "deck-empty": "Choose one of your decks or paste a list.",
  "deck-long": "That list is too long.",
  "deck-unreadable":
    "Some lines of that list could not be read. Check it in the deck editor first.",
  "deck-locked": "Decks are locked once the run starts.",
  "handle-clash":
    "Another player already plays under a handle like yours. Ask an admin, or change your handle.",
  "already-registered": "You are already registered.",
  "not-withdrawable": "Entries are fixed once the run starts.",
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
  registered: "You are registered. Your deck can change until the run starts.",
  deck: "Your deck is updated.",
  withdrawn: "Withdrawn.",
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
