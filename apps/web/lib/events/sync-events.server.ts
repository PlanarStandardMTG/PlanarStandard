import type { EventSchedule, EventSyncState } from "@ps/contracts";
import { eventSchedule, parseChallongeEvents, syncCutoff } from "@ps/core";
import {
  claimSyncWindow,
  getSyncState,
  listCachedEvents,
  recordSyncResult,
  replaceEvents,
} from "@ps/db";

import { fetchCommunityTournaments, isChallongeConfigured } from "@/lib/challonge/client.server";
import { createPublicClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role.server";

/**
 * The read-through cache behind `/events` (E23.8).
 *
 * A thin coordinator, in the §11.1 sense: every decision it looks like it makes
 * belongs to a pure function. Whether a refresh is due is `sync-window`'s;
 * whether two callers both get to refresh is the repository's single conditional
 * update; what the payload means is `parse-challonge-events`'; what the page
 * shows is `event-schedule`'s. What is left here is the order of operations.
 *
 *   claim the window → fetch → parse → replace → record → read the cache
 *
 * The cache is read at the end either way. A refresh that failed still serves the
 * events we had, because a schedule that is two hours stale is worth far more
 * than an error page.
 */

export interface EventsView {
  readonly schedule: EventSchedule;
  readonly sync: EventSyncState | null;
  /** False on every machine without the production secrets — the page says so rather than lying. */
  readonly configured: boolean;
}

export async function loadEvents(now: Date = new Date()): Promise<EventsView> {
  if (isChallongeConfigured()) {
    await refreshIfDue(now);
  }

  const publicClient = createPublicClient();
  const [events, sync] = await Promise.all([
    listCachedEvents(publicClient, "challonge"),
    // The sync ledger has no read policy, so "when was this last refreshed"
    // needs the service-role client even though the answer is shown publicly.
    isChallongeConfigured()
      ? getSyncState(createServiceRoleClient(), "challonge")
      : Promise.resolve(null),
  ]);

  return {
    schedule: eventSchedule(events, now),
    sync,
    configured: isChallongeConfigured(),
  };
}

/**
 * Spend one request, if one is owed.
 *
 * Nothing here rethrows. This runs inside a page render, and the caller has a
 * cache to fall back on; a Challonge outage must cost a stale schedule, not the
 * page.
 */
async function refreshIfDue(now: Date): Promise<void> {
  try {
    const service = createServiceRoleClient();
    const claimed = await claimSyncWindow(
      service,
      "challonge",
      syncCutoff(now),
      now.toISOString(),
    );
    if (!claimed) return;

    const result = await fetchCommunityTournaments();

    if (result.status !== "ok") {
      const error = result.status === "failed" ? result.error : "challonge is not configured";
      await recordSyncResult(service, "challonge", { error });
      return;
    }

    const events = parseChallongeEvents(result.payload);
    const fetchedAt = new Date().toISOString();

    await replaceEvents(service, "challonge", events, fetchedAt);
    await recordSyncResult(service, "challonge", {
      succeededAt: fetchedAt,
      eventCount: events.length,
    });
  } catch (cause) {
    // The window has already been claimed at this point, so a failure here costs
    // one interval of staleness and not a retry storm.
    console.error("event refresh failed:", cause instanceof Error ? cause.message : String(cause));
  }
}
