import type { EventCompletion } from "@ps/contracts";

/**
 * What happens once a tournament has ended (E23.13). Called exactly once per
 * event by `processCompletedEvents`, never inside a page render, and never
 * again after it returns — so this is the one place a finished tournament's
 * results are fetched.
 *
 * A no-op until the pieces it will coordinate exist:
 *
 *   1. fetch the results — `lib/melee/results.server.ts` for melee.gg, already
 *      scrubbed to melee ids, results and decklists (E12.11)
 *   2. parse and stage them as an import (`adapters/melee-api`, E12.10;
 *      `repos/results`' `createImport`, E13.18)
 *   3. recompute what they feed — ratings (E18.12) and the derived stats (E18)
 *
 * Throw to fail: the completion is released and retried on a later run, up to
 * its attempt limit. Returning marks it processed for good.
 */
export async function onTournamentCompleted(completion: EventCompletion): Promise<void> {
  void completion;
}

/**
 * What an admin's "re-run everything" clears before every finished tournament
 * goes round the queue again (`/admin/processing`). A no-op until there is
 * derived data to clear: the ratings and stats tables E18's recompute writes.
 *
 * Never the ledger. `tournaments` and `matches` also hold organiser and manual
 * imports the queue cannot recreate, and re-importing an event supersedes its
 * old rows anyway (§26), so clearing them would lose data without fixing any.
 */
export async function onFullRerun(): Promise<void> {}
