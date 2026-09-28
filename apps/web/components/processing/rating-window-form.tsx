"use client";

import type { RatingWindow } from "@ps/contracts";
import { startTransition, useActionState, useState, type FormEvent } from "react";

/**
 * The dates Elo replays (E25.6), both inclusive; a blank end takes every event
 * from the start onwards. The action arrives as a prop, since it recomputes
 * with the service-role client (E1.7).
 */
export interface RatingWindowState {
  readonly error: string | null;
}

export type SaveRatingWindowAction = (
  previous: RatingWindowState,
  form: FormData,
) => Promise<RatingWindowState>;

const FIELD =
  "mt-1.5 w-full rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm " +
  "focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950";

const BUTTON =
  "rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 " +
  "disabled:opacity-60 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper";

export function RatingWindowForm({
  initial,
  save,
}: {
  initial: RatingWindow;
  save: SaveRatingWindowAction;
}) {
  const [state, action, pending] = useActionState<RatingWindowState, FormData>(save, {
    error: null,
  });
  const [from, setFrom] = useState(initial.from);
  const [until, setUntil] = useState(initial.until ?? "");

  // Submitted by hand: React resets a form after its action runs, which would
  // put back the saved dates over a failed save's.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };

  return (
    <form
      action={action}
      onSubmit={submit}
      aria-labelledby="rating-window"
      className="mb-6 rounded-xl border border-ink-200 px-5 py-4 dark:border-ink-800"
    >
      <h2 id="rating-window" className="font-semibold">
        Elo time frame
      </h2>
      <p className="text-xs text-ink-500 dark:text-ink-400">
        Rated events on or between these dates count. With no end date, every event from the start
        onwards counts. Saving recomputes the ratings.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-4">
        <div className="w-full sm:w-44">
          <label htmlFor="rated_from" className="text-sm font-medium">
            Start date
          </label>
          <input
            id="rated_from"
            name="rated_from"
            type="date"
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={FIELD}
          />
        </div>
        <div className="w-full sm:w-44">
          {/* A date input offers no way back to empty in every browser. */}
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="rated_until" className="text-sm font-medium">
              End date <span className="font-normal text-ink-500">(optional)</span>
            </label>
            {until !== "" && (
              <button
                type="button"
                onClick={() => setUntil("")}
                className="cursor-pointer text-xs font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
              >
                Clear
              </button>
            )}
          </div>
          <input
            id="rated_until"
            name="rated_until"
            type="date"
            min={from}
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className={FIELD}
          />
        </div>
        <button type="submit" disabled={pending} className={BUTTON}>
          {pending ? "Saving…" : "Save time frame"}
        </button>
      </div>
      {state.error !== null && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
