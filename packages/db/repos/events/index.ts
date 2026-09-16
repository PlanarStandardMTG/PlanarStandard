import type {
  EventSource,
  EventSyncState,
  ExternalEvent,
  ParsedExternalEvent,
} from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  EVENT_COLUMNS,
  SYNC_COLUMNS,
  toExternalEvent,
  toSyncState,
  type ExternalEventRow,
  type SyncRow,
} from "./rows";

/**
 * Reads and writes over `external_events` and `external_event_syncs` (E23.6).
 *
 * The reads go through the public client and are covered by a public-read
 * policy. The four writes need the service-role client: the sync ledger has RLS
 * on and no policy at all, because nothing but the server has any business
 * knowing when the site last called a third party.
 */

/** Every cached event for a source. Grouping and ordering is `core/events/event-schedule`'s job. */
export async function listCachedEvents(
  client: SupabaseClient,
  source: EventSource,
): Promise<readonly ExternalEvent[]> {
  const { data, error } = await client
    .from("external_events")
    .select(EVENT_COLUMNS)
    .eq("source", source)
    .order("starts_at", { ascending: false, nullsFirst: false });

  if (error !== null) throw new Error(`listCachedEvents failed: ${error.message}`);
  return (data as unknown as ExternalEventRow[]).map(toExternalEvent);
}

/** When this source was last fetched. Null when the ledger row is somehow missing. */
export async function getSyncState(
  client: SupabaseClient,
  source: EventSource,
): Promise<EventSyncState | null> {
  const { data, error } = await client
    .from("external_event_syncs")
    .select(SYNC_COLUMNS)
    .eq("source", source)
    .maybeSingle();

  if (error !== null) throw new Error(`getSyncState failed: ${error.message}`);
  return data === null ? null : toSyncState(data as unknown as SyncRow);
}

/**
 * Take the right to refresh this source, or find that somebody already has.
 *
 * One conditional update, so the decision and the claim are the same statement
 * and two simultaneous requests cannot both win. Doing this as a read followed by
 * a write would let a burst of traffic fire a fetch per request, which on a
 * 500-a-month budget is the failure the whole cache exists to prevent.
 *
 * Stamping `last_attempted_at` up front is also what makes an outage cheap: the
 * window is spent whether the fetch that follows succeeds or not.
 */
export async function claimSyncWindow(
  serviceClient: SupabaseClient,
  source: EventSource,
  cutoff: string,
  now: string,
): Promise<boolean> {
  const { data, error } = await serviceClient
    .from("external_event_syncs")
    .update({ last_attempted_at: now })
    .eq("source", source)
    .or(`last_attempted_at.is.null,last_attempted_at.lt.${cutoff}`)
    .select("source");

  if (error !== null) throw new Error(`claimSyncWindow failed: ${error.message}`);
  return (data ?? []).length > 0;
}

/**
 * Replace the cached calendar for a source wholesale.
 *
 * Replacement rather than a merge, for the same reason a results re-import
 * supersedes (§26): the payload is the whole truth about what the calendar
 * contains, so an event the organiser has deleted has to leave the cache. Rows
 * are upserted first and the survivors deleted after, so a reader mid-refresh
 * sees the old calendar or the new one, never a gap.
 */
export async function replaceEvents(
  serviceClient: SupabaseClient,
  source: EventSource,
  events: readonly ParsedExternalEvent[],
  fetchedAt: string,
): Promise<void> {
  if (events.length > 0) {
    const { error } = await serviceClient.from("external_events").upsert(
      events.map((event) => ({
        source,
        external_id: event.externalId,
        name: event.name,
        url: event.url,
        state: event.state,
        starts_at: event.startsAt,
        participant_count: event.participantCount,
        structure: event.structure,
        fetched_at: fetchedAt,
      })),
      { onConflict: "source,external_id" },
    );

    if (error !== null) throw new Error(`replaceEvents upsert failed: ${error.message}`);
  }

  const kept = events.map((event) => event.externalId);
  const stale = serviceClient.from("external_events").delete().eq("source", source);
  const { error } =
    kept.length === 0 ? await stale : await stale.not("external_id", "in", asInList(kept));

  if (error !== null) throw new Error(`replaceEvents prune failed: ${error.message}`);
}

/** Record how the refresh went. The window itself was already spent by the claim. */
export async function recordSyncResult(
  serviceClient: SupabaseClient,
  source: EventSource,
  result:
    { readonly succeededAt: string; readonly eventCount: number } | { readonly error: string },
): Promise<void> {
  const patch =
    "error" in result
      ? { last_error: result.error }
      : { last_succeeded_at: result.succeededAt, last_error: null, event_count: result.eventCount };

  const { error } = await serviceClient
    .from("external_event_syncs")
    .update(patch)
    .eq("source", source);

  if (error !== null) throw new Error(`recordSyncResult failed: ${error.message}`);
}

/**
 * PostgREST's `in` takes a parenthesised list, and a value containing a comma or
 * a quote would otherwise end the list early. Challonge ids are numeric strings,
 * but a second source's need not be.
 */
function asInList(values: readonly string[]): string {
  return `(${values.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")})`;
}
