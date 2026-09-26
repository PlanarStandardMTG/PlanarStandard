"use client";

import { useRef, useState } from "react";

import { RERUN_CONFIRMATION } from "@/lib/jobs/rerun-confirmation";

const OUTLINE_BUTTON =
  "rounded-lg border border-ink-300 px-4 py-2 text-sm text-ink-700 dark:border-ink-700 dark:text-ink-300";

/**
 * Send every finished tournament round the queue again (E23.13). Large enough —
 * every event's results fetched again, every statistic rebuilt — that the admin
 * types a word to confirm it rather than clicking twice.
 *
 * The action arrives as a prop rather than an import: it reaches `.server.ts`
 * modules, and `scripts/check-server-only.ts` keeps every `'use client'` file
 * from importing anything that does.
 */
export function RerunEverythingButton({
  finished,
  action,
}: {
  finished: number;
  action: (form: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const confirmed = typed.trim().toLowerCase() === RERUN_CONFIRMATION;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTyped("");
          dialogRef.current?.showModal();
        }}
        className={`${OUTLINE_BUTTON} hover:border-red-400 hover:text-red-700 dark:hover:text-red-400`}
      >
        Re-run everything
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="rerun-title"
        className="m-auto w-full max-w-md rounded-xl border border-ink-200 bg-paper p-6 text-ink-900 backdrop:bg-black/40 dark:border-ink-800 dark:bg-ink-950 dark:text-ink-100"
      >
        <form action={action}>
          <h2 id="rerun-title" className="font-semibold">
            Re-run every finished tournament?
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-600 dark:text-ink-400">
            <li>
              All {finished} finished {finished === 1 ? "tournament goes" : "tournaments go"} back
              in the queue, with any finished calendar event that was never queued.
            </li>
            <li>
              Each one’s results are fetched again, a few requests at a time against each source’s
              rate limit, so this takes as many runs as it takes.
            </li>
            <li>Ratings and statistics are rebuilt from the results as they come back in.</li>
            <li>
              Imported results themselves are not deleted — re-importing an event replaces its old
              results.
            </li>
          </ul>
          <label htmlFor="rerun-confirm" className="mt-4 block text-sm">
            Type <span className="font-mono font-semibold">{RERUN_CONFIRMATION}</span> to confirm
          </label>
          <input
            id="rerun-confirm"
            name="confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="mt-1.5 w-full rounded-lg border border-ink-300 bg-paper px-3 py-2 font-mono text-sm focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950"
          />
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className={`${OUTLINE_BUTTON} hover:border-ink-500`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!confirmed}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              Re-run everything
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
