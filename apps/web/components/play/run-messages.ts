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
  | "not-withdrawable"
  | "guest-name"
  | "arena-tag"
  | "arena-too-long"
  | "not-running"
  | "swiss-rounds-done"
  | "round-has-results"
  | "no-pairing-without-rematch"
  | "result-refused"
  | "result-invalid";

/** What a refused run form or move means, in the site's voice. Codes come from `core/runs`. */
export const RUN_ERRORS: Readonly<
  Record<RunDetailsProblem | RunMoveRefusal | RunPageProblem, string>
> = {
  "no-handle": "Set a handle on your profile first.",
  "registration-closed": "Registration is not open.",
  "deck-empty": "Choose one of your decks or paste a list.",
  "deck-long": "That list is too long.",
  "deck-unreadable": "Some lines of that list could not be read.",
  "deck-locked": "Decks are locked once the event starts.",
  "handle-clash": "That handle is taken by another player. Change yours or ask an admin.",
  "already-registered": "You are already registered.",
  "not-withdrawable": "Entries are fixed once the event starts.",
  "guest-name": "A guest needs a name of up to 60 characters.",
  "arena-tag": "An Arena username needs its tag, like Brayzon#12345.",
  "arena-too-long": "That Arena username is too long.",
  "not-running": "That is done while the event is being played.",
  "swiss-rounds-done": "Every Swiss round has been paired.",
  "round-has-results": "A result is in, so this round can no longer be re-paired.",
  "result-refused": "Only the organizer can change a confirmed result.",
  "result-invalid": "That result isn't allowed here.",
  "no-pairing-without-rematch": "No pairing avoids a rematch. Reduce the Swiss rounds.",
  "name-empty": "An event needs a name.",
  "name-long": "That name is too long.",
  "no-format": "Tick at least one format version.",
  "swiss-rounds": "Swiss rounds must be a whole number from 0 to 20.",
  "top-cut": "The top cut must be a whole number from 0 to 512.",
  "nothing-to-play": "With no Swiss rounds, the event needs a top cut of at least 2.",
  "not-a-move": "The event cannot move there from where it is.",
  "too-few-entrants": "Check in at least two players to start.",
  "has-swiss-rounds": "Play the Swiss rounds before the top cut.",
  "no-swiss-rounds": "This event has no Swiss rounds: start the top cut.",
  "no-top-cut": "This event has no top cut.",
  "has-top-cut": "Play the top cut before finishing.",
  "swiss-rounds-left": "There are Swiss rounds still to play.",
  "results-missing": "Some results are still to be confirmed.",
  "cut-unfinished": "The top cut has no champion yet.",
};

export const RUN_DONE: Readonly<Record<string, string>> = {
  saved: "Saved.",
  registered: "Registered.",
  deck: "Deck updated.",
  withdrawn: "Withdrawn.",
  guest: "Guest added.",
  dropped: "Dropped.",
  started: "Started.",
  paired: "Paired.",
  repaired: "Re-paired.",
  reported: "Reported.",
  confirmed: "Confirmed.",
  "result-set": "Result saved.",
  "cut-finished": "Top cut complete.",
  finished: "Finished.",
  unchanged: "No changes to import.",
  chased: "Players notified.",
  "chase-unsent": "Neither player has notifications on.",
  registration: "Registration open.",
  cancelled: "Cancelled.",
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
