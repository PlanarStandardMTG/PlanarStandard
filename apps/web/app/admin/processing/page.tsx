import { completionStatus, type CompletionStatus } from "@ps/core";
import { listCompletions, listNamedEntries, listSourcedTournaments } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";

import { Notice } from "@/components/auth/form-parts";
import { DecklistUploadForm } from "@/components/processing/decklist-upload-form";
import { RerunEverythingButton } from "@/components/processing/rerun-everything-button";
import { TournamentLines } from "@/components/processing/tournament-lines";
import type { BadgeVariant } from "@/components/ui/badge";
import { Placement } from "@/components/ui/marks";
import { requireRole } from "@/lib/auth/guard";
import { EVENT_SOURCE_LABELS } from "@/lib/events/source-label";
import { formatDate } from "@/lib/format-date";
import { createSessionClient } from "@/lib/supabase/session";

import { chooseLine, leaveLine, processNow, rerunEverything, uploadDecklists } from "./actions";

export const dynamic = "force-dynamic";

/** "Process now" runs a pass in this request; each event in it spends a few API requests. */
export const maxDuration = 300;

export const metadata: Metadata = {
  title: "Tournament processing",
  robots: { index: false, follow: false },
};

/** Enough for several seasons' events; the filter narrows it. */
const SHOWN = 500;

const STATUS: Readonly<Record<CompletionStatus, readonly [string, BadgeVariant]>> = {
  waiting: ["Waiting", "neutral"],
  running: ["Running", "neutral"],
  retrying: ["Retrying", "neutral"],
  "gave-up": ["Gave up", "accent"],
  processed: ["Processed", "outline"],
  excluded: ["Not included", "outline"],
};

const TABS = [
  { label: "Tournaments", href: "/admin/processing", view: "tournaments" },
  { label: "Decklists", href: "/admin/processing?view=decklists", view: "decklists" },
] as const;

const BUTTON =
  "rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 " +
  "dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper";

/**
 * The queue of finished tournaments (E23.13): the lines each goes down
 * (E18.22), and the events whose decklists are still missing (E20.37).
 */
export default async function AdminProcessingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("admin");
  const params = await searchParams;
  const view = params["view"] === "decklists" ? "decklists" : "tournaments";
  const now = new Date();

  const client = await createSessionClient();
  const completions = await listCompletions(client, SHOWN);
  const rows = completions.map((completion) => ({
    completion,
    status: completionStatus(completion, now),
  }));
  const count = (status: CompletionStatus) => rows.filter((row) => row.status === status).length;
  const pending = count("waiting") + count("retrying") + count("running");

  return (
    <>
      <header className="mb-8">
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Tournament processing</h1>
        <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">
          When the calendar sees a tournament finish, it queues it here once. Each one goes down the
          lines ticked for it — Elo rates its matches, Decklists stores its lists against its
          standings — a single time, by the scheduled job or by the button below. Monthlies start on
          both; anything on neither is left alone.
        </p>
      </header>

      <Outcome params={params} />

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Waiting", pending],
            ["Processed", count("processed")],
            ["Not included", count("excluded")],
            ["Gave up", count("gave-up")],
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

      <nav className="mb-6 flex gap-6 border-b border-ink-200 text-sm dark:border-ink-800">
        {TABS.map((tab) => (
          <Link
            key={tab.view}
            href={tab.href}
            aria-current={tab.view === view ? "page" : undefined}
            className="-mb-px border-b-2 border-transparent py-3 text-ink-500 aria-[current=page]:border-gold-700 aria-[current=page]:font-semibold aria-[current=page]:text-ink-900 dark:text-ink-400 dark:aria-[current=page]:border-gold-400 dark:aria-[current=page]:text-ink-100"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {view === "decklists" ? (
        <MissingDecklists
          processed={completions.filter((c) => c.processedAt !== null && c.decklists)}
        />
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-600 dark:text-ink-400">
          Nothing yet. A tournament appears here the first time the calendar sees it finish.
        </p>
      ) : (
        <TournamentLines
          rows={rows.map(({ completion, status }) => ({
            key: { source: completion.source, externalId: completion.externalId },
            name: completion.name,
            detail: `${EVENT_SOURCE_LABELS[completion.source]} · ${completion.externalId} · ${formatDate(completion.detectedAt)}`,
            status: STATUS[status][0],
            variant: STATUS[status][1],
            error: status === "processed" ? null : completion.lastError,
            processed: status === "processed",
            elo: completion.elo,
            decklists: completion.decklists,
          }))}
          choose={chooseLine}
          leave={leaveLine}
        />
      )}
    </>
  );
}

/**
 * Every processed event on the decklist line, those with an entry that has no
 * deck first, and a sheet to fill each from (E20.37). melee.gg sends lists for some events
 * and Challonge never does, so this is where most of them arrive.
 */
async function MissingDecklists({
  processed,
}: {
  processed: readonly { readonly source: string; readonly externalId: string }[];
}) {
  const client = await createSessionClient();
  const wanted = new Set(processed.map((c) => `${c.source}:${c.externalId}`));
  const tournaments = (await listSourcedTournaments(client))
    .filter((ref) => wanted.has(`${ref.source}:${ref.externalId}`))
    .map((ref) => ref.tournament);
  // One read per event: a whole season's entries at once can pass PostgREST's row cap.
  const entries = await Promise.all(tournaments.map((t) => listNamedEntries(client, [t.id])));
  // Missing first; an event stays listed once complete, so a sheet's report stays on screen
  // and a list can still be replaced.
  const events = tournaments
    .map((tournament, i) => {
      const all = entries[i] ?? [];
      return { tournament, entries: all, without: all.filter((entry) => entry.deckId === null) };
    })
    .sort((a, b) => Number(b.without.length > 0) - Number(a.without.length > 0));

  if (events.length === 0) {
    return (
      <p className="text-sm text-ink-600 dark:text-ink-400">
        No processed event is on the decklist line yet.
      </p>
    );
  }

  return (
    <>
      <p className="mb-6 max-w-prose text-sm text-ink-600 dark:text-ink-400">
        {events.filter((event) => event.without.length > 0).length} of {events.length} events on the
        decklist line are missing decks. Upload a CSV with a{" "}
        <code className="font-mono">player</code> and a <code className="font-mono">deck</code>{" "}
        column. A deck is a link to one on this site, its id, or the list written out — a card per
        line, or <code className="font-mono">;</code> between cards. Each list is matched to the
        player&rsquo;s own saved decks first, and stored straight away.
      </p>
      <ul className="space-y-6">
        {events.map(({ tournament, entries, without }) => {
          return (
            <li
              key={tournament.id}
              className="rounded-lg border border-ink-200 p-5 dark:border-ink-800"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-serif text-2xl">{tournament.name}</h2>
                <p className="font-mono text-xs text-ink-500 dark:text-ink-400">
                  {formatDate(tournament.eventDate)} · {entries.length - without.length} of{" "}
                  {entries.length} decks
                </p>
              </div>
              {without.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm">
                    {without.length} {without.length === 1 ? "player" : "players"} without a deck
                  </summary>
                  <ul className="mt-2 columns-1 gap-6 text-sm sm:columns-2">
                    {without.map((entry) => (
                      <li key={entry.id} className="flex items-center gap-1">
                        {entry.placement === null ? (
                          <span className="w-[2.2em]" />
                        ) : (
                          <Placement place={entry.placement} className="text-sm" />
                        )}
                        {entry.displayName ?? entry.handles[0] ?? "Hidden player"}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <DecklistUploadForm tournamentId={tournament.id} action={uploadDecklists} />
            </li>
          );
        })}
      </ul>
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
