import type { EventCompletion, EventSyncState } from "@ps/contracts";
import { completionStatus, EVENT_SYNC_INTERVAL_MS, type CompletionStatus } from "@ps/core";
import {
  listCompletions,
  listNamedEntries,
  listTournamentCoverage,
  type TournamentCoverage,
} from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";

import { Notice } from "@/components/auth/form-parts";
import { DecklistUploadForm } from "@/components/fetching/decklist-upload-form";
import { EventTable, type EventRow } from "@/components/fetching/event-table";
import { RefetchEverythingButton } from "@/components/fetching/refetch-everything-button";
import type { BadgeVariant } from "@/components/ui/badge";
import { Placement } from "@/components/ui/marks";
import { requireRole } from "@/lib/auth/guard";
import { EVENT_SOURCE_LABELS } from "@/lib/events/source-label";
import { listCalendarSyncs, type CalendarSync } from "@/lib/events/sync-events.server";
import { formatDate, formatTimeAgo } from "@/lib/format-date";
import { createSessionClient } from "@/lib/supabase/session";

import {
  fetchNow,
  refetchEvent,
  refetchEverything,
  refreshCalendar,
  uploadDecklists,
  type EventKey,
} from "./actions";

export const dynamic = "force-dynamic";

/** "Fetch now" runs a pass in this request; each event in it spends a few API requests. */
export const maxDuration = 300;

export const metadata: Metadata = {
  title: "Event fetching",
  robots: { index: false, follow: false },
};

/** Enough for several seasons' events; the filter narrows it. */
const SHOWN = 500;

const STATUS: Readonly<Record<CompletionStatus, readonly [string, BadgeVariant]>> = {
  waiting: ["Waiting", "neutral"],
  running: ["Running", "neutral"],
  retrying: ["Retrying", "neutral"],
  "gave-up": ["Gave up", "accent"],
  fetched: ["Fetched", "outline"],
};

type View = "events" | "matches" | "decklists";

const BUTTON =
  "rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 " +
  "dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper";

const OUTLINE_BUTTON =
  "rounded-lg border border-ink-300 px-4 py-2 text-sm text-ink-700 hover:border-ink-500 " +
  "disabled:opacity-50 dark:border-ink-700 dark:text-ink-300 dark:hover:border-ink-500";

/**
 * Where finished events come in from their platforms (E25.2): the fetch queue
 * (E23.13), and what each fetch did not bring back. The only admin page that
 * calls an external API; what an event counts towards is `/admin/processing`.
 */
export default async function AdminFetchingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("admin");
  const params = await searchParams;
  const view: View =
    params["view"] === "matches" || params["view"] === "decklists" ? params["view"] : "events";
  const now = new Date();

  const client = await createSessionClient();
  const [completions, coverage, calendars] = await Promise.all([
    listCompletions(client, SHOWN),
    listTournamentCoverage(client),
    listCalendarSyncs(),
  ]);
  const stored = new Map(
    coverage.flatMap((row) =>
      row.source === null || row.externalId === null
        ? []
        : [[`${row.source}:${row.externalId}`, row] as const],
    ),
  );
  const rows = completions.map((completion) => ({
    completion,
    status: completionStatus(completion, now),
    tournament: stored.get(`${completion.source}:${completion.externalId}`) ?? null,
  }));

  const count = (status: CompletionStatus) => rows.filter((row) => row.status === status).length;
  const withoutMatches = rows.filter(
    (row) =>
      row.status === "gave-up" ||
      (row.status === "fetched" && (row.tournament === null || row.tournament.matches === 0)),
  );
  const withoutDecks = rows.filter(
    ({ tournament }) => tournament !== null && tournament.decks < tournament.entries,
  );

  const tabs: readonly { view: View; label: string; count: number }[] = [
    { view: "events", label: "Events", count: rows.length },
    { view: "matches", label: "Missing match history", count: withoutMatches.length },
    { view: "decklists", label: "Missing decklists", count: withoutDecks.length },
  ];

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Event fetching</h1>
        <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">
          When the calendar sees a tournament finish, it queues it here once. The scheduled job, or
          the button below, fetches each one from melee.gg or Challonge and stores everything it
          sends: matches, standings, and any decklists. What an event counts towards is decided on{" "}
          <Link
            href="/admin/processing"
            className="text-eclipse-700 hover:underline dark:text-eclipse-400"
          >
            Data processing
          </Link>
          .
        </p>
      </header>

      <Outcome params={params} />

      <Calendars calendars={calendars} now={now} />

      <dl className="mb-6 grid grid-cols-3 gap-3">
        {(
          [
            ["Waiting", count("waiting") + count("retrying") + count("running")],
            ["Fetched", count("fetched")],
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
        <form action={fetchNow}>
          <button type="submit" className={BUTTON}>
            Fetch now
          </button>
        </form>
        <RefetchEverythingButton finished={rows.length} action={refetchEverything} />
        <p className="text-xs text-ink-500 dark:text-ink-400">
          A pass takes a few waiting events; press it again for the rest.
        </p>
      </div>

      <nav className="mb-6 flex flex-wrap gap-x-6 border-b border-ink-200 text-sm dark:border-ink-800">
        {tabs.map((tab) => (
          <Link
            key={tab.view}
            href={tab.view === "events" ? "/admin/fetching" : `/admin/fetching?view=${tab.view}`}
            aria-current={tab.view === view ? "page" : undefined}
            className="-mb-px border-b-2 border-transparent py-3 text-ink-500 aria-[current=page]:border-gold-700 aria-[current=page]:font-semibold aria-[current=page]:text-ink-900 dark:text-ink-400 dark:aria-[current=page]:border-gold-400 dark:aria-[current=page]:text-ink-100"
          >
            {tab.label} <span className="tabular-nums">{tab.count}</span>
          </Link>
        ))}
      </nav>

      {view === "decklists" ? (
        <MissingDecklists
          rows={withoutDecks}
          open={typeof params["event"] === "string" ? params["event"] : null}
        />
      ) : view === "matches" ? (
        <>
          <p className="mb-6 max-w-prose text-sm text-ink-600 dark:text-ink-400">
            Events whose fetch stored no matches — the platform sent none, or every attempt failed.
            Re-fetch one to try its platform again. Uploading its match history as a CSV is not
            built yet.
          </p>
          <EventRows rows={withoutMatches} empty="Every fetched event has its match history." />
        </>
      ) : (
        <EventRows
          rows={rows}
          empty="Nothing yet. A tournament appears here the first time the calendar sees it finish."
        />
      )}
    </>
  );
}

interface QueueRow {
  readonly completion: EventCompletion;
  readonly status: CompletionStatus;
  readonly tournament: TournamentCoverage | null;
}

function EventRows({
  rows,
  empty,
  action,
}: {
  rows: readonly QueueRow[];
  empty: string;
  action?: (row: QueueRow) => EventRow<EventKey>["action"];
}) {
  if (rows.length === 0) return <p className="text-sm text-ink-600 dark:text-ink-400">{empty}</p>;
  return (
    <EventTable<EventKey>
      rows={rows.map((row): EventRow<EventKey> => {
        const { completion, status, tournament } = row;
        const link = action?.(row);
        return {
          key: { source: completion.source, externalId: completion.externalId },
          name: completion.name,
          detail: `${EVENT_SOURCE_LABELS[completion.source]} · ${completion.externalId} · ${formatDate(completion.detectedAt)}`,
          status: STATUS[status][0],
          variant: STATUS[status][1],
          note:
            status === "fetched"
              ? tournament === null || tournament.matches === 0
                ? "The platform sent no matches."
                : null
              : completion.lastError,
          stored: tournament === null ? null : storedLine(tournament),
          href: tournament === null ? null : `/tournaments/${tournament.tournament.slug}`,
          ...(link === undefined ? {} : { action: link }),
        };
      })}
      refetch={refetchEvent}
    />
  );
}

function storedLine({ matches, entries, decks }: TournamentCoverage): string {
  return `${matches} ${matches === 1 ? "match" : "matches"} · ${decks} of ${entries} decks`;
}

/**
 * Every stored event with a player who has no deck, and a sheet to fill each
 * from (E20.37). melee.gg sends lists for some events and Challonge never does,
 * so this is where most of them arrive. One event is open at a time, above the
 * table: its players are one read, and a season of them at once is hundreds.
 */
async function MissingDecklists({
  rows,
  open,
}: {
  rows: readonly QueueRow[];
  open: string | null;
}) {
  const opened = rows.find((row) => row.tournament?.tournament.id === open)?.tournament ?? null;
  const without =
    opened === null
      ? []
      : (await listNamedEntries(await createSessionClient(), [opened.tournament.id])).filter(
          (entry) => entry.deckId === null,
        );

  return (
    <>
      <p className="mb-6 max-w-prose text-sm text-ink-600 dark:text-ink-400">
        Choose &ldquo;Add decklists&rdquo; on an event, then upload a CSV with a{" "}
        <code className="font-mono">player</code> and a <code className="font-mono">deck</code>{" "}
        column, and optionally an <code className="font-mono">archetype</code>. A deck is a link to
        one on this site, its id, or the list written out — a card per line, or{" "}
        <code className="font-mono">;</code> between cards. Each list is matched to the
        player&rsquo;s own saved decks first, and stored straight away.
      </p>

      {opened !== null && (
        <section
          id="add-decklists"
          className="mb-6 scroll-mt-6 rounded-lg border border-ink-200 p-5 dark:border-ink-800"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl">{opened.tournament.name}</h2>
            <Link
              href="/admin/fetching?view=decklists"
              className="text-sm text-eclipse-700 hover:underline dark:text-eclipse-400"
            >
              Close
            </Link>
          </div>
          <p className="font-mono text-xs text-ink-500 dark:text-ink-400">
            {formatDate(opened.tournament.eventDate)} · {opened.decks} of {opened.entries} decks
          </p>
          {without.length > 0 && (
            <ul className="mt-3 columns-1 gap-6 text-sm sm:columns-2">
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
          )}
          <DecklistUploadForm tournamentId={opened.tournament.id} action={uploadDecklists} />
        </section>
      )}

      <EventRows
        rows={rows}
        empty="Every stored event has its decklists."
        action={({ tournament }) =>
          tournament === null
            ? undefined
            : {
                label: "Add decklists",
                href: `/admin/fetching?view=decklists&event=${tournament.tournament.id}#add-decklists`,
              }
        }
      />
    </>
  );
}

/**
 * Each platform's calendar is what queues a finished event, and it refreshes
 * itself on a page view once its last attempt is two hours old
 * (`core/events/sync-window`). These buttons skip the wait (E25.7).
 */
function Calendars({ calendars, now }: { calendars: readonly CalendarSync[]; now: Date }) {
  return (
    <section className="mt-6 mb-8 rounded-xl border border-ink-200 p-5 dark:border-ink-800">
      <h2 className="font-semibold">Calendars</h2>
      <p className="mt-1 max-w-prose text-sm text-ink-600 dark:text-ink-400">
        A finished event joins the queue when its platform&rsquo;s calendar is next refreshed, which
        happens by itself every two hours. Refresh one now if an event has just finished. Each press
        spends a request, and Challonge allows 500 a month.
      </p>
      <ul className="mt-4 divide-y divide-ink-200 dark:divide-ink-800">
        {calendars.map(({ source, configured, sync }) => (
          <li key={source} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="text-sm">
              <p className="font-medium">{EVENT_SOURCE_LABELS[source]}</p>
              <p className="text-ink-600 dark:text-ink-400">
                {configured ? lastFetched(sync, now) : "Not configured on this deployment."}
              </p>
              {configured && sync !== null && sync.lastError !== null && (
                <p className="text-red-700 dark:text-red-400">
                  The last attempt
                  {sync.lastAttemptedAt === null
                    ? ""
                    : `, ${formatTimeAgo(sync.lastAttemptedAt, now)},`}{" "}
                  failed: {sync.lastError}
                </p>
              )}
            </div>
            <form action={refreshCalendar}>
              <input type="hidden" name="source" value={source} />
              <button type="submit" disabled={!configured} className={OUTLINE_BUTTON}>
                Refresh {EVENT_SOURCE_LABELS[source]}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

function lastFetched(sync: EventSyncState | null, now: Date): string {
  if (sync === null || sync.lastSucceededAt === null) return "Never fetched.";
  const fetched = `Fetched ${formatTimeAgo(sync.lastSucceededAt, now)}, ${sync.eventCount} ${sync.eventCount === 1 ? "event" : "events"}.`;
  if (sync.lastAttemptedAt === null) return fetched;
  const dueInMs = Date.parse(sync.lastAttemptedAt) + EVENT_SYNC_INTERVAL_MS - now.getTime();
  return dueInMs <= 0
    ? `${fetched} Due again on the next page view.`
    : `${fetched} Due again ${formatTimeUntil(dueInMs)}.`;
}

function formatTimeUntil(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
}

function Outcome({ params }: { params: Record<string, string | string[] | undefined> }) {
  const value = (key: string) => (typeof params[key] === "string" ? params[key] : undefined);

  if (value("error") === "confirm") {
    return (
      <Notice tone="warn">Nothing was re-fetched — the confirmation word did not match.</Notice>
    );
  }
  if (value("done") === "fetched") {
    const failed = Number(value("failed") ?? 0);
    return (
      <Notice tone={failed > 0 ? "warn" : "good"}>
        Fetched {value("fetched") ?? 0}
        {failed > 0 ? `; ${failed} failed and will be retried` : ""}.
      </Notice>
    );
  }
  if (value("done") === "calendar") {
    const source = value("source") === "melee" ? "melee" : "challonge";
    const label = EVENT_SOURCE_LABELS[source];
    const queued = Number(value("queued") ?? 0);
    switch (value("outcome")) {
      case "refreshed":
        return (
          <Notice tone="good">
            Refreshed {label}: {value("events") ?? 0} events
            {queued > 0
              ? `, and ${queued} newly finished ${queued === 1 ? "one" : "ones"} queued. Press "Fetch now" to fetch ${queued === 1 ? "it" : "them"}.`
              : ", and nothing new has finished."}
          </Notice>
        );
      case "busy":
        return <Notice tone="warn">{label} was being refreshed already. Try again shortly.</Notice>;
      case "not-configured":
        return <Notice tone="warn">{label} is not configured on this deployment.</Notice>;
      default:
        return (
          <Notice tone="warn">
            {label} could not be refreshed: {value("reason") ?? "unknown error"}.
          </Notice>
        );
    }
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
