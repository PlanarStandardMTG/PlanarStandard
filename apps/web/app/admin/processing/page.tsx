import { completionStatus, type CompletionStatus } from "@ps/core";
import { listCompletions } from "@ps/db";
import type { Metadata } from "next";

import { Notice } from "@/components/auth/form-parts";
import { RerunEverythingButton } from "@/components/processing/rerun-everything-button";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth/guard";
import { EVENT_SOURCE_LABELS } from "@/lib/events/source-label";
import { formatDate } from "@/lib/format-date";
import { createSessionClient } from "@/lib/supabase/session";

import { processNow, rerunEverything } from "./actions";

export const dynamic = "force-dynamic";

/** "Process now" runs a pass in this request; each event in it spends a few API requests. */
export const maxDuration = 300;

export const metadata: Metadata = {
  title: "Tournament processing",
  robots: { index: false, follow: false },
};

/** Enough for a season's events; the page is a queue, not an archive. */
const SHOWN = 200;

const STATUS: Readonly<Record<CompletionStatus, string>> = {
  waiting: "Waiting",
  running: "Running",
  retrying: "Retrying",
  "gave-up": "Gave up",
  processed: "Processed",
};

const BUTTON =
  "rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 " +
  "dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-white";

/** The queue of finished tournaments, and the two ways an admin moves it (E23.13). */
export default async function AdminProcessingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("admin");
  const params = await searchParams;
  const now = new Date();

  const completions = await listCompletions(await createSessionClient(), SHOWN);
  const rows = completions.map((completion) => ({
    completion,
    status: completionStatus(completion, now),
  }));
  const count = (status: CompletionStatus) => rows.filter((row) => row.status === status).length;
  const pending = count("waiting") + count("retrying") + count("running");

  return (
    <>
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Tournament processing</h1>
        <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">
          When the calendar sees a tournament finish, it queues it here once. Each queued tournament
          has its results fetched and processed a single time, by the scheduled job or by the button
          below.
        </p>
      </header>

      <Outcome params={params} />

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Waiting", pending],
            ["Processed", count("processed")],
            ["Gave up", count("gave-up")],
            ["In the queue", rows.length],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-ink-200 px-4 py-3 dark:border-ink-800"
          >
            <dt className="text-xs text-ink-500 dark:text-ink-400">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <form action={processNow}>
          <button type="submit" className={BUTTON}>
            Process now
          </button>
        </form>
        <RerunEverythingButton finished={rows.length} action={rerunEverything} />
        <p className="text-xs text-ink-500 dark:text-ink-400">
          A pass takes a few waiting tournaments; press it again for the rest.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-600 dark:text-ink-400">
          Nothing yet. A tournament appears here the first time the calendar sees it finish.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ink-200 dark:border-ink-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-xs tracking-wide text-ink-500 uppercase dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400">
              <tr>
                <th className="px-4 py-2 font-semibold">Tournament</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Finished</th>
                <th className="px-4 py-2 font-semibold">Tries</th>
                <th className="px-4 py-2 font-semibold">Last error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
              {rows.map(({ completion, status }) => (
                <tr key={`${completion.source}-${completion.externalId}`}>
                  <td className="px-4 py-2">
                    <span className="font-medium">{completion.name}</span>
                    <span className="block text-xs text-ink-500 dark:text-ink-400">
                      {EVENT_SOURCE_LABELS[completion.source]} · {completion.externalId}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Badge
                      variant={
                        status === "processed"
                          ? "outline"
                          : status === "gave-up"
                            ? "accent"
                            : "neutral"
                      }
                    >
                      {STATUS[status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {formatDate(completion.detectedAt)}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{completion.attempts}</td>
                  <td className="px-4 py-2 text-xs text-red-700 dark:text-red-400">
                    {completion.lastError ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Outcome({ params }: { params: Record<string, string | string[] | undefined> }) {
  const value = (key: string) => (typeof params[key] === "string" ? params[key] : undefined);

  if (value("error") === "confirm") {
    return <Notice tone="warn">Nothing was re-run — the confirmation word did not match.</Notice>;
  }
  if (value("done") === "processed") {
    const failed = Number(value("failed") ?? 0);
    return (
      <Notice tone={failed > 0 ? "warn" : "good"}>
        Processed {value("processed") ?? 0}
        {failed > 0 ? `; ${failed} failed and will be retried` : ""}.
      </Notice>
    );
  }
  if (value("done") === "requeued") {
    return (
      <Notice tone="good">
        Every finished tournament is back in the queue — {value("waiting") ?? 0} waiting.
      </Notice>
    );
  }
  return null;
}
