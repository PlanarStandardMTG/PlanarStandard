import type {
  EventSchedule,
  EventSource,
  EventSyncState,
  ParsedExternalEvent,
} from "@ps/contracts";
import { eventSchedule, parseChallongeEvents, parseMeleeEvents, syncCutoff } from "@ps/core";
import {
  claimSyncWindow,
  getSyncState,
  listAllCachedEvents,
  recordSyncResult,
  replaceEvents,
} from "@ps/db";

import { fetchCommunityTournaments, isChallongeConfigured } from "@/lib/challonge/client.server";
import type { CalendarFetch } from "@/lib/events/calendar-fetch";
import { fetchTournamentList, isMeleeConfigured } from "@/lib/melee/client.server";
import { createPublicClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role.server";

/**
 * The read-through cache behind `/events` (E23.8, E23.12).
 *
 * A thin coordinator, in the §11.1 sense: every decision it looks like it makes
 * belongs to a pure function. Whether a refresh is due is `sync-window`'s;
 * whether two callers both get to refresh is the repository's single conditional
 * update; what the payload means is each parser's; what the page shows is
 * `event-schedule`'s. What is left here is the order of operations.
 *
 *   claim the window → fetch → parse → replace → record → read the cache
 *
 * The cache is read at the end either way. A refresh that failed still serves the
 * events we had, because a schedule that is two hours stale is worth far more
 * than an error page.
 *
 * Refreshing is per-source and reading is not. A fetch has to know whose calendar
 * it is spending a request on, and one platform's outage must not spend the
 * other's window — so every calendar claims its own ledger row, and the two run
 * side by side. A visitor asking what is on this weekend does not care, so the
 * read is `listAllCachedEvents` and the schedule is one list.
 */

/**
 * A calendar the site fetches: which ledger row it spends, how to ask, and how to
 * read the answer. Adding a third is an entry here, a client and a parser.
 */
interface Calendar {
  readonly source: EventSource;
  readonly isConfigured: () => boolean;
  readonly fetchEvents: () => Promise<CalendarFetch>;
  readonly parse: (payload: unknown) => readonly ParsedExternalEvent[];
}

const CALENDARS: readonly Calendar[] = [
  {
    source: "challonge",
    isConfigured: isChallongeConfigured,
    fetchEvents: fetchCommunityTournaments,
    parse: parseChallongeEvents,
  },
  {
    source: "melee",
    isConfigured: isMeleeConfigured,
    fetchEvents: fetchTournamentList,
    parse: parseMeleeEvents,
  },
];

export interface EventsView {
  readonly schedule: EventSchedule;
  /**
   * The ledger row of every calendar the site is configured to fetch, in the
   * order they are listed above. Says how stale the *fetched* part of the
   * schedule is, per source; seeded rows have no sync.
   */
  readonly syncs: readonly EventSyncState[];
  /** False on every machine without the production secrets — the page says so rather than lying. */
  readonly configured: boolean;
}

export async function loadEvents(now: Date = new Date()): Promise<EventsView> {
  const calendars = CALENDARS.filter((calendar) => calendar.isConfigured());

  // Side by side: each claims its own window, and a slow platform should not add
  // its timeout to the other's before the page can render.
  await Promise.all(calendars.map((calendar) => refreshIfDue(calendar, now)));

  const publicClient = createPublicClient();
  const [events, syncs] = await Promise.all([
    listAllCachedEvents(publicClient),
    // The sync ledger has no read policy, so "when was this last refreshed"
    // needs the service-role client even though the answer is shown publicly.
    readSyncStates(calendars),
  ]);

  return {
    schedule: eventSchedule(events, now),
    syncs,
    configured: calendars.length > 0,
  };
}

async function readSyncStates(calendars: readonly Calendar[]): Promise<readonly EventSyncState[]> {
  if (calendars.length === 0) return [];

  const service = createServiceRoleClient();
  const states = await Promise.all(
    calendars.map((calendar) => getSyncState(service, calendar.source)),
  );

  return states.filter((state): state is EventSyncState => state !== null);
}

/**
 * Spend one request against one calendar, if one is owed.
 *
 * Nothing here rethrows. This runs inside a page render, and the caller has a
 * cache to fall back on; one platform's outage must cost a stale schedule, not
 * the page, and not the other platform's refresh either.
 */
async function refreshIfDue(calendar: Calendar, now: Date): Promise<void> {
  const { source } = calendar;

  try {
    const service = createServiceRoleClient();
    const claimed = await claimSyncWindow(service, source, syncCutoff(now), now.toISOString());
    if (!claimed) return;

    const result = await calendar.fetchEvents();

    if (result.status !== "ok") {
      const error = result.status === "failed" ? result.error : `${source} is not configured`;
      await recordSyncResult(service, source, { error });
      return;
    }

    const events = calendar.parse(result.payload);
    const fetchedAt = new Date().toISOString();

    await replaceEvents(service, source, events, fetchedAt);
    await recordSyncResult(service, source, {
      succeededAt: fetchedAt,
      eventCount: events.length,
    });
  } catch (cause) {
    // The window has already been claimed at this point, so a failure here costs
    // one interval of staleness and not a retry storm.
    console.error(
      `${source} event refresh failed:`,
      cause instanceof Error ? cause.message : String(cause),
    );
  }
}
