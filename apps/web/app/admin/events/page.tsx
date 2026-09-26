import { listScheduledEvents } from "@ps/db";
import type { Metadata } from "next";

import { Notice } from "@/components/auth/form-parts";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/guard";
import { formatDateTime } from "@/lib/format-date";
import { createSessionClient } from "@/lib/supabase/session";

import { setStartTime } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Event dates",
  robots: { index: false, follow: false },
};

const DONE: Readonly<Record<string, string>> = {
  set: "Start time saved. The schedule shows it now.",
  cleared: "Start time cleared.",
};

const ERRORS: Readonly<Record<string, string>> = {
  invalid: "That is not a date and time.",
  missing: "That event is no longer in melee.gg's calendar.",
};

const FIELD =
  "rounded-lg border border-ink-300 bg-paper px-3 py-1.5 text-sm focus:border-eclipse-500 " +
  "focus:outline-none dark:border-ink-700 dark:bg-ink-950";

const BUTTON =
  "rounded-lg bg-ink-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-ink-700 " +
  "dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper";

/**
 * melee.gg events and when they start (E23.15). Its API sends no start time,
 * so an admin types one in; undated events come first, then newest first.
 */
export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("admin");
  const params = await searchParams;
  const done = typeof params["done"] === "string" ? params["done"] : undefined;
  const error = typeof params["error"] === "string" ? params["error"] : undefined;

  const events = [...(await listScheduledEvents(await createSessionClient(), "melee"))].sort(
    (a, b) =>
      (a.event.startsAt === null ? 0 : 1) - (b.event.startsAt === null ? 0 : 1) ||
      (b.event.startsAt ?? "").localeCompare(a.event.startsAt ?? ""),
  );
  const undated = events.filter((e) => e.event.startsAt === null).length;

  return (
    <>
      <header className="mb-6">
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Event dates</h1>
        <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">
          melee.gg&rsquo;s API doesn&rsquo;t send when an event starts, so set it here. Times are
          UTC, as the site shows them, and a calendar refresh keeps what you set.
          {undated > 0 && (
            <>
              {" "}
              <strong className="text-ink-900 dark:text-ink-100">
                {undated} {undated === 1 ? "event has" : "events have"} no date.
              </strong>
            </>
          )}
        </p>
      </header>

      {done !== undefined && DONE[done] !== undefined && <Notice tone="good">{DONE[done]}</Notice>}
      {error !== undefined && ERRORS[error] !== undefined && (
        <Notice tone="warn">{ERRORS[error]}</Notice>
      )}

      {events.length === 0 ? (
        <EmptyState title="No melee.gg events cached">
          They appear here once the calendar has been fetched.
        </EmptyState>
      ) : (
        <ul className="mt-6 divide-y divide-ink-200 rounded-xl border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
          {events.map(({ event, manualStartsAt }) => (
            <li
              key={event.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {event.url === null ? (
                    event.name
                  ) : (
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {event.name}
                    </a>
                  )}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
                  {event.startsAt === null ? (
                    <Badge variant="accent">No date</Badge>
                  ) : (
                    <span className="font-mono">{formatDateTime(event.startsAt)}</span>
                  )}
                  {manualStartsAt !== null && <span>set by hand</span>}
                  <span className="capitalize">{event.state}</span>
                </p>
              </div>
              <form action={setStartTime} className="flex shrink-0 items-center gap-2">
                <input type="hidden" name="event" value={event.externalId} />
                <label className="sr-only" htmlFor={`starts-${event.id}`}>
                  Start time of {event.name}, UTC
                </label>
                <input
                  id={`starts-${event.id}`}
                  type="datetime-local"
                  name="startsAt"
                  required
                  defaultValue={
                    event.startsAt === null
                      ? ""
                      : new Date(event.startsAt).toISOString().slice(0, 16)
                  }
                  className={FIELD}
                />
                <button type="submit" className={BUTTON}>
                  Save
                </button>
                {manualStartsAt !== null && (
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
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
