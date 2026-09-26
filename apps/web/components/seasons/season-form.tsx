"use client";

import { SEASON_NAME_MAX, type SeasonDraftProblem } from "@ps/core";
import { startTransition, useActionState, useState, type FormEvent } from "react";

/**
 * One season's name, dates and whether it is current (E20.35). A client
 * component so a failed save keeps what the admin typed; the checking is the
 * server action's.
 *
 * The action arrives as a prop rather than an import: it recomputes the ladder
 * with the service-role client, and `scripts/check-server-only.ts` (E1.7)
 * refuses any client module that can reach that.
 */
export interface SeasonSaveState {
  readonly problems: readonly SeasonDraftProblem[];
}

export type SaveSeasonAction = (
  previous: SeasonSaveState,
  form: FormData,
) => Promise<SeasonSaveState>;

const FIELD =
  "mt-1.5 w-full rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm " +
  "focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950";

const BUTTON =
  "rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 " +
  "disabled:opacity-60 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper";

export interface SeasonFormValues {
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly isCurrent: boolean;
}

function describe(problem: SeasonDraftProblem): string {
  switch (problem.field) {
    case "name":
      return problem.code === "empty"
        ? "Give the season a name."
        : `Keep the name under ${SEASON_NAME_MAX} characters.`;
    case "startsOn":
      return problem.code === "overlap"
        ? `These dates overlap ${problem.season}. An event can only belong to one season.`
        : "Choose the date the season starts.";
    case "endsOn":
      return problem.code === "invalid"
        ? "That end date isn’t a date."
        : "The end date is before the start.";
  }
}

export function SeasonForm({
  id,
  initial,
  save,
}: {
  id: string | null;
  initial: SeasonFormValues;
  save: SaveSeasonAction;
}) {
  const [state, action, pending] = useActionState<SeasonSaveState, FormData>(save, {
    problems: [],
  });
  const [values, setValues] = useState(initial);
  const set = <K extends keyof SeasonFormValues>(key: K, value: SeasonFormValues[K]) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  // Submitted by hand: React resets a form after its action runs, which would
  // clear the controlled checkbox on a failed save.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };
  const about = (field: SeasonDraftProblem["field"]) =>
    state.problems.filter((p) => p.field === field).map(describe);

  return (
    <form action={action} onSubmit={submit} className="max-w-xl space-y-6">
      {id !== null && <input type="hidden" name="id" value={id} />}

      <div>
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={SEASON_NAME_MAX}
          placeholder="Season III"
          className={FIELD}
        />
        <Problems messages={about("name")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="starts_on" className="text-sm font-medium">
            Starts
          </label>
          <input
            id="starts_on"
            name="starts_on"
            type="date"
            value={values.startsOn}
            onChange={(e) => set("startsOn", e.target.value)}
            className={FIELD}
          />
          <Problems messages={about("startsOn")} />
        </div>
        <div>
          <label htmlFor="ends_on" className="text-sm font-medium">
            Ends <span className="font-normal text-ink-500">(blank while it runs)</span>
          </label>
          <input
            id="ends_on"
            name="ends_on"
            type="date"
            value={values.endsOn}
            onChange={(e) => set("endsOn", e.target.value)}
            className={FIELD}
          />
          <Problems messages={about("endsOn")} />
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-ink-300 px-3 py-2 text-sm has-checked:border-eclipse-500 dark:border-ink-700">
        <input
          type="checkbox"
          name="is_current"
          checked={values.isCurrent}
          onChange={(e) => set("isCurrent", e.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="font-medium">The current season</span>
          <span className="block text-xs text-ink-500 dark:text-ink-400">
            The leaderboard rates only this season’s Monthlies. Saving takes it from whichever
            season has it now, and the ladder is recomputed.
          </span>
        </span>
      </label>

      <p className="text-xs text-ink-500 dark:text-ink-400">
        Tournaments follow their dates: saving files every event dated inside this season into it.
      </p>

      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? "Saving…" : id === null ? "Create season" : "Save season"}
      </button>
    </form>
  );
}

function Problems({ messages }: { messages: readonly string[] }) {
  if (messages.length === 0) return null;
  return (
    <ul role="alert" className="mt-2 space-y-1 text-sm text-red-700 dark:text-red-400">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}
