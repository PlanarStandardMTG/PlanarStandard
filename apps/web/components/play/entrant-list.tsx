import type { Run, RunEntrant, RunEntrantDeck } from "@ps/contracts";

import {
  addGuestAction,
  checkInAction,
  dropAction,
  withdrawAction,
} from "@/app/play/events/actions";

import { PRIMARY, QUIET, SECONDARY } from "./button";

const FIELD =
  "mt-1 w-full rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm " +
  "focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950";

function statusOf(entrant: RunEntrant, started: boolean): string {
  if (entrant.droppedAfterRound !== null) {
    return entrant.droppedAfterRound === 0
      ? "dropped before round 1"
      : `dropped after round ${entrant.droppedAfterRound}`;
  }
  if (started) return entrant.checkedIn ? "" : "not checked in";
  return entrant.checkedIn ? "checked in" : "";
}

/**
 * The run's entrants (E26.18). Everyone sees who is in; the organizer also sees each
 * deck's state and checks people in, adds guests and removes entries before the run
 * starts, and drops people once it has. A drop is final: nobody re-enters (§28).
 */
export function EntrantList({
  run,
  entrants,
  decks,
  manages,
}: {
  run: Run;
  entrants: readonly RunEntrant[];
  decks: ReadonlyMap<string, RunEntrantDeck>;
  manages: boolean;
}) {
  const before = run.state === "draft" || run.state === "registration";
  const playing = run.state === "running" || run.state === "top_cut";
  const waiting = entrants.filter((e) => !e.checkedIn).map((e) => e.id);

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl">
          Entrants <span className="text-base text-ink-500">{entrants.length}</span>
        </h2>
        {manages && before && waiting.length > 0 && (
          <form action={checkInAction}>
            <input type="hidden" name="runId" value={run.id} />
            <input type="hidden" name="checkedIn" value="1" />
            {waiting.map((id) => (
              <input key={id} type="hidden" name="entrantId" value={id} />
            ))}
            <button className={QUIET}>Check everyone in</button>
          </form>
        )}
      </div>

      {entrants.length === 0 ? (
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">Nobody yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-ink-200 text-sm dark:divide-ink-800">
          {entrants.map((entrant) => {
            const deck = decks.get(entrant.id);
            const status = statusOf(entrant, !before);
            return (
              <li key={entrant.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="min-w-0 flex-1">
                  <span
                    className={
                      entrant.droppedAfterRound === null ? "" : "text-ink-500 line-through"
                    }
                  >
                    {entrant.displayName}
                  </span>
                  {entrant.profileId === null && (
                    <span className="ml-1.5 text-xs text-ink-500">guest</span>
                  )}
                  {status !== "" && <span className="ml-2 text-xs text-ink-500">{status}</span>}
                </span>
                {manages && (
                  <span className="text-xs text-ink-500 dark:text-ink-400">
                    {deck === undefined
                      ? "no deck"
                      : deck.isLegal === false
                        ? "deck not legal"
                        : "deck in"}
                  </span>
                )}
                {manages && before && (
                  <form action={checkInAction}>
                    <input type="hidden" name="runId" value={run.id} />
                    <input type="hidden" name="entrantId" value={entrant.id} />
                    <input type="hidden" name="checkedIn" value={entrant.checkedIn ? "0" : "1"} />
                    <button className={QUIET}>
                      {entrant.checkedIn ? "Undo check-in" : "Check in"}
                    </button>
                  </form>
                )}
                {manages && before && (
                  <form action={withdrawAction}>
                    <input type="hidden" name="runId" value={run.id} />
                    <input type="hidden" name="entrantId" value={entrant.id} />
                    <button className={QUIET}>Remove</button>
                  </form>
                )}
                {manages && playing && entrant.droppedAfterRound === null && (
                  <form action={dropAction}>
                    <input type="hidden" name="runId" value={run.id} />
                    <input type="hidden" name="entrantId" value={entrant.id} />
                    <button className={QUIET}>Drop</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {manages && before && (
        <details className="mt-4 rounded-xl border border-ink-200 p-4 dark:border-ink-800">
          <summary className="cursor-pointer text-sm font-medium">Add a guest</summary>
          <form action={addGuestAction} className="mt-3 space-y-3">
            <input type="hidden" name="runId" value={run.id} />
            <div>
              <label htmlFor="guestName" className="text-sm">
                Name
              </label>
              <input id="guestName" name="displayName" required maxLength={60} className={FIELD} />
            </div>
            <div>
              <label htmlFor="guestArena" className="text-sm">
                Arena username
              </label>
              <input
                id="guestArena"
                name="arenaUsername"
                placeholder="Name#12345"
                className={FIELD}
              />
              <p className="mt-1 text-xs text-ink-500">
                Only you and their opponent while paired can see it.
              </p>
            </div>
            <div>
              <label htmlFor="guestList" className="text-sm">
                Decklist (optional)
              </label>
              <textarea id="guestList" name="decklist" rows={5} className={`${FIELD} font-mono`} />
            </div>
            <div className="flex gap-3">
              <button className={PRIMARY}>Add guest</button>
              <button type="reset" className={SECONDARY}>
                Clear
              </button>
            </div>
          </form>
        </details>
      )}
    </section>
  );
}
