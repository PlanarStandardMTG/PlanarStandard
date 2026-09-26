"use client";

import { useActionState } from "react";

export interface UploadState {
  readonly attached: number;
  readonly unchanged: number;
  readonly issues: readonly string[];
}

const EMPTY: UploadState = { attached: 0, unchanged: 0, issues: [] };

/**
 * One event's decklist sheet (E20.37). The action arrives as a prop, as in
 * `TournamentLines`.
 */
export function DecklistUploadForm({
  tournamentId,
  action,
}: {
  tournamentId: string;
  action: (previous: UploadState, form: FormData) => Promise<UploadState>;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY);
  const done = state !== EMPTY;

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="tournament" value={tournamentId} />
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="file"
          accept=".csv,.tsv,.txt,text/csv"
          aria-label="Decklist CSV"
          className="text-sm file:mr-3 file:rounded-lg file:border file:border-ink-300 file:bg-transparent file:px-3 file:py-1.5 file:text-sm dark:file:border-ink-700"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 disabled:opacity-60 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper"
        >
          {pending ? "Attaching…" : "Upload and attach"}
        </button>
      </div>
      {done && (
        <div role="status" className="text-sm">
          <p>
            {state.attached} {state.attached === 1 ? "deck" : "decks"} attached
            {state.unchanged > 0 && `, ${state.unchanged} already there`}.
          </p>
          {state.issues.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-amber-800 dark:text-amber-300">
              {state.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
