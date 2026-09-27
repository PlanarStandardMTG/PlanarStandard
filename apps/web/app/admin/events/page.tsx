import { listScheduledEvents } from "@ps/db";
import type { Metadata } from "next";

import { Notice } from "@/components/auth/form-parts";
import { StartTimeForm } from "@/components/events/start-time-form";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/ui/local-time";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/guard";
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
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Event dates</h1>
        <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">
          melee.gg&rsquo;s API doesn&rsquo;t send when an event starts, so set it here in your own
          time zone; saving shows the UTC time that is stored. A calendar refresh keeps what you
          set.
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
                    <LocalTime iso={event.startsAt} className="font-mono" />
                  )}
                  {manualStartsAt !== null && <span>set by hand</span>}
                  <span className="capitalize">{event.state}</span>
                </p>
              </div>
              <StartTimeForm
                eventName={event.name}
                externalId={event.externalId}
                startsAt={event.startsAt}
                manual={manualStartsAt !== null}
                action={setStartTime}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
