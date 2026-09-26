import type { EventSyncState } from "@ps/contracts";
import type { Metadata } from "next";

import { EventGroup } from "@/components/events/event-group";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { EVENT_SOURCE_LABELS } from "@/lib/events/source-label";
import { loadEvents } from "@/lib/events/sync-events.server";
import { formatTimeAgo } from "@/lib/format-date";
import { load } from "@/lib/load";

/**
 * The schedule is a read-through cache of somebody else's calendar, refreshed at
 * most once every couple of hours (see `core/events/sync-window`). Static
 * generation would pin it to build time and the "as of" line would be a lie.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Upcoming and in-progress Planar Standard tournaments, with a link to each event page.",
};

export default async function EventsPage() {
  const now = new Date();
  const events = await load(() => loadEvents(now));

  return (
    <div className="night flex-1">
      <Container className="py-12">
        <PageHeader kicker="The schedule" title="Events">
          Tournaments the community is running, wherever they are running them. Entry, pairings, and
          results all live on the event&rsquo;s own page — this is the schedule.
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
            <EventGroup title="Recently finished" events={events.value.schedule.past} />

            <p className="mt-10 border-t border-ink-200 pt-4 text-xs text-ink-500 dark:border-ink-800 dark:text-ink-400">
              {freshness(events.value.syncs, now)}
            </p>
          </>
        )}
      </Container>
    </div>
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
