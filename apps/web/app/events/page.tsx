import type { EventSyncState, ExternalEvent } from "@ps/contracts";
import type { Metadata } from "next";
import Link from "next/link";

import { EventGroup } from "@/components/events/event-group";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Pager } from "@/components/ui/pager";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { EVENT_SOURCE_LABELS } from "@/lib/events/source-label";
import { loadEvents, resultKey } from "@/lib/events/sync-events.server";
import { formatTimeAgo } from "@/lib/format-date";
import { load } from "@/lib/load";
import { pageOf } from "@/lib/paging";

/**
 * The schedule is a read-through cache of somebody else's calendar, refreshed at
 * most once every couple of hours (see `core/events/sync-window`). Static
 * generation would pin it to build time and the "as of" line would be a lie.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Upcoming and past Planar Standard tournaments, with standings, rounds and decklists for finished events.",
};

/** Finished events per page. */
const PAST_PAGE_SIZE = 10;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const now = new Date();
  const [events, params] = await Promise.all([load(() => loadEvents(now)), searchParams]);

  return (
    <div className="night flex-1">
      <Container className="py-12">
        <PageHeader kicker="The schedule" title="Events">
          Upcoming and live events, and results from every past one.
        </PageHeader>

        {!events.ok ? (
          <ErrorState title="Could not load the schedule" detail={events.error} />
        ) : events.value.schedule.live.length === 0 &&
          events.value.schedule.upcoming.length === 0 &&
          events.value.schedule.past.length === 0 ? (
          <EmptyState title="No events on the calendar">
            {events.value.configured
              ? "Nothing is scheduled right now. Organisers post new brackets a week or two ahead."
              : "This site has no calendar credentials configured, so nothing is being fetched. Run `pnpm db:reset` for seed events."}
          </EmptyState>
        ) : (
          <>
            <EventGroup title="Happening now" events={events.value.schedule.live} />
            <EventGroup title="Upcoming" events={events.value.schedule.upcoming} />
            <PastEvents
              events={events.value.schedule.past}
              page={params["page"]}
              query={typeof params["q"] === "string" ? params["q"].trim() : ""}
              resultSlugs={events.value.resultSlugs}
            />

            <p className="mt-10 border-t border-ink-200 pt-4 text-xs text-ink-500 dark:border-ink-800 dark:text-ink-400">
              {freshness(events.value.syncs, now)}
            </p>
          </>
        )}
      </Container>
    </div>
  );
}

/** Finished events, newest first, filtered by a word in the name and a page at a time. */
function PastEvents({
  events,
  page,
  query,
  resultSlugs,
}: {
  events: readonly ExternalEvent[];
  page: string | string[] | undefined;
  query: string;
  resultSlugs: ReadonlyMap<string, string>;
}) {
  if (events.length === 0) return null;
  const needle = query.toLowerCase();
  const matching =
    needle === "" ? events : events.filter((event) => event.name.toLowerCase().includes(needle));
  const shown = pageOf(matching, page, PAST_PAGE_SIZE);
  const href = (n: number) => {
    const search = new URLSearchParams();
    if (query !== "") search.set("q", query);
    if (n > 1) search.set("page", String(n));
    const text = search.toString();
    return `/events${text === "" ? "" : `?${text}`}#past`;
  };
  return (
    <div id="past" className="scroll-mt-24">
      <EventGroup
        title="Past events"
        events={shown.items}
        lead={<PastFilter query={query} matches={matching.length} />}
        empty={
          <p className="text-sm text-ink-600 dark:text-ink-400">
            No past event has &ldquo;{query}&rdquo; in its name.
          </p>
        }
        resultsHref={(event) => {
          const slug = resultSlugs.get(resultKey(event));
          return slug === undefined ? undefined : `/tournaments/${slug}`;
        }}
      >
        <Pager page={shown.page} pages={shown.pages} href={href} previous="Newer" next="Older" />
      </EventGroup>
    </div>
  );
}

function PastFilter({ query, matches }: { query: string; matches: number }) {
  return (
    <form action="/events#past" className="mb-5 flex flex-wrap items-center gap-3 text-sm">
      <label htmlFor="past-q" className="sr-only">
        Filter past events by name
      </label>
      <input
        id="past-q"
        type="search"
        name="q"
        defaultValue={query}
        placeholder="Filter by name, e.g. monthly"
        className="w-full max-w-xs rounded-full border border-ink-200 bg-transparent px-4 py-1.5 placeholder:text-ink-400 focus:border-eclipse-500 focus:outline-none sm:w-72 dark:border-ink-800 dark:placeholder:text-ink-600"
      />
      <button
        type="submit"
        className="rounded-full border border-ink-200 px-4 py-1.5 hover:border-eclipse-500/60 dark:border-ink-800"
      >
        Filter
      </button>
      {query !== "" && (
        <>
          <span className="text-ink-500 dark:text-ink-400">
            {matches} {matches === 1 ? "event" : "events"}
          </span>
          <Link
            href="/events#past"
            className="text-eclipse-700 hover:underline dark:text-eclipse-400"
          >
            Clear
          </Link>
        </>
      )}
    </form>
  );
}

/**
 * Says how old the schedule is, in the reader's terms.
 *
 * Worth the paragraph: a cache refreshed every couple of hours will sometimes be
 * wrong, and a visitor who can see how stale it is knows to click through rather
 * than trust the participant count.
 *
 * One clause per calendar, because the two are refreshed independently and can
 * be hours apart — a single "refreshed 5 minutes ago" over a schedule where
 * melee.gg last answered yesterday would be the useful half of the truth.
 */
function freshness(syncs: readonly EventSyncState[], now: Date): string {
  if (syncs.length === 0) return "Showing locally seeded events.";

  const clauses = syncs.map((sync) => {
    const label = EVENT_SOURCE_LABELS[sync.source];
    return sync.lastSucceededAt === null
      ? `${label} (not yet)`
      : `${label} ${formatTimeAgo(sync.lastSucceededAt, now)}`;
  });

  return `Refreshed from ${clauses.join(" · ")}. Check the event page for anything time-critical.`;
}
