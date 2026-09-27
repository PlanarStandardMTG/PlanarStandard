"use client";

import { useRef, useState, type FormEvent } from "react";

import { useHydrated } from "@/components/ui/hydrated";
import { formatDateTime, formatLocalDateTime } from "@/lib/format-date";

const FIELD =
  "rounded-lg border border-ink-300 bg-paper px-3 py-1.5 text-sm focus:border-eclipse-500 " +
  "focus:outline-none dark:border-ink-700 dark:bg-ink-950";

const BUTTON =
  "rounded-lg bg-ink-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-ink-700 " +
  "dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper";

/** `2026-10-17T19:00` in the browser's zone, as a `datetime-local` field wants it. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * One event's start time, typed in the admin's own zone (E23.15). Saving asks
 * first, showing the time as typed and the UTC time that is stored, since
 * the zone is the browser's guess and a wrong one is otherwise invisible.
 *
 * The action arrives as a prop: it reaches the service-role client (E1.7).
 */
export function StartTimeForm({
  eventName,
  externalId,
  startsAt,
  manual,
  action,
}: {
  eventName: string;
  externalId: string;
  startsAt: string | null;
  manual: boolean;
  action: (form: FormData) => Promise<void>;
}) {
  const hydrated = useHydrated();
  const dialog = useRef<HTMLDialogElement>(null);
  const [chosen, setChosen] = useState<Date | null>(null);

  const ask = (event: FormEvent<HTMLFormElement>) => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter?.getAttribute("name") !== "save") return;
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("local")?.toString() ?? "";
    const date = new Date(value);
    if (value === "" || Number.isNaN(date.getTime())) return;
    setChosen(date);
    dialog.current?.showModal();
  };

  return (
    <form action={action} onSubmit={ask} className="flex shrink-0 items-center gap-2">
      <input type="hidden" name="event" value={externalId} />
      <input type="hidden" name="startsAt" value={chosen?.toISOString() ?? ""} />
      <label className="sr-only" htmlFor={`starts-${externalId}`}>
        Start time of {eventName}, in your time zone
      </label>
      <input
        key={hydrated ? "local" : "server"}
        id={`starts-${externalId}`}
        type="datetime-local"
        name="local"
        required
        disabled={!hydrated}
        defaultValue={hydrated && startsAt !== null ? toLocalInput(startsAt) : ""}
        className={FIELD}
      />
      <button type="submit" name="save" disabled={!hydrated} className={BUTTON}>
        Save
      </button>
      {manual && (
        <button
          type="submit"
          name="clear"
          value="1"
          formNoValidate
          className="text-sm text-ink-500 hover:underline dark:text-ink-400"
        >
          Clear
        </button>
      )}

      <dialog
        ref={dialog}
        onClose={() => setChosen(null)}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-ink-200 bg-paper p-6 text-ink-900 shadow-xl backdrop:bg-ink-950/50 dark:border-ink-800 dark:bg-ink-950 dark:text-ink-100"
      >
        <h2 className="font-serif text-xl tracking-tight">Save this start time?</h2>
        <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">{eventName}</p>
        {chosen !== null && (
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-500 dark:text-ink-400">You entered</dt>
            <dd className="font-mono">
              {formatLocalDateTime(chosen)}
              <span className="block text-xs text-ink-500 dark:text-ink-400">
                {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </span>
            </dd>
            <dt className="text-ink-500 dark:text-ink-400">Saved as</dt>
            <dd className="font-mono font-semibold">{formatDateTime(chosen.toISOString())}</dd>
          </dl>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="rounded-lg px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-900"
          >
            Cancel
          </button>
          <button type="submit" name="confirm" className={BUTTON}>
            Save
          </button>
        </div>
      </dialog>
    </form>
  );
}
