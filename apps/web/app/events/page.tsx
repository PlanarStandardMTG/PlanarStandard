import type { Metadata } from "next";

import { EventGroup } from "@/components/events/event-group";
import { Container } from "@/components/ui/container";
import { EmptyState, ErrorState } from "@/components/ui/states";
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
    <Container className="py-12">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Events</h1>
        <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">
          Tournaments the community is running, wherever they are running them. Entry, pairings, and
          results all live on the event&rsquo;s own page — this is the schedule.
        </p>
      </header>

      {!events.ok ? (
        <ErrorState title="Could not load the schedule" detail={events.error} />
      ) : events.value.schedule.live.length === 0 &&
        events.value.schedule.upcoming.length === 0 &&
        events.value.schedule.past.length === 0 ? (
        <EmptyState title="No events on the calendar">
          {events.value.configured
            ? "Nothing is scheduled right now. Organisers post new brackets a week or two ahead."
            : "This site has no Challonge credentials configured, so nothing is being fetched. Run `pnpm db:reset` for seed events."}
        </EmptyState>
      ) : (
        <>
          <EventGroup title="Happening now" events={events.value.schedule.live} />
          <EventGroup title="Upcoming" events={events.value.schedule.upcoming} />
          <EventGroup title="Recently finished" events={events.value.schedule.past} />

          <p className="mt-10 border-t border-ink-200 pt-4 text-xs text-ink-500 dark:border-ink-800 dark:text-ink-400">
            {freshness(events.value.sync, now)}
          </p>
        </>
      )}
    </Container>
  );
}

/**
 * Says how old the schedule is, in the reader's terms.
 *
 * Worth the paragraph: a cache refreshed every couple of hours will sometimes be
 * wrong, and a visitor who can see how stale it is knows to click through rather
 * than trust the participant count.
 *
 * Challonge by name, though the schedule itself is source-agnostic, because it
 * is the only calendar the site fetches. When a second one is wired up this
 * needs a ledger row per source rather than a second sentence (E23.12).
 */
function freshness(sync: { lastSucceededAt: string | null } | null, now: Date): string {
  if (sync === null) return "Showing locally seeded events.";
  if (sync.lastSucceededAt === null) return "Not yet refreshed from Challonge.";
  return `Refreshed from Challonge ${formatTimeAgo(sync.lastSucceededAt, now)}. Check the event page for anything time-critical.`;
}
