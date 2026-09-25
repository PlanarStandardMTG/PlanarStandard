import type {
  EventCompletion,
  EventSource,
  EventSyncState,
  ExternalEvent,
  ParsedExternalEvent,
} from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  COMPLETION_COLUMNS,
  EVENT_COLUMNS,
  SYNC_COLUMNS,
  toCompletion,
  toExternalEvent,
  toSyncState,
  type CompletionRow,
  type ExternalEventRow,
  type SyncRow,
} from "./rows";

/**
 * Reads and writes over `external_events`, `external_event_syncs` (E23.6) and
 * the `event_completions` queue (E23.13).
 *
 * The event reads go through the public client and are covered by a public-read
 * policy. Every write, and anything touching the ledger or the queue, needs the
 * service-role client: those tables have RLS on and no policy at all, because
 * nothing but the server has any business knowing when the site last called a
 * third party.
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

/**
 * Every cached event, whatever calendar it came from.
 *
 * The site's view of what is on is not per-platform: an organiser running on
 * melee.gg and one running on Challonge are advertising the same format, and a
 * visitor asking what is next does not care which. `listCachedEvents` stays for
 * the refresh, which is necessarily scoped to the source being refreshed.
 */
export async function listAllCachedEvents(
  client: SupabaseClient,
): Promise<readonly ExternalEvent[]> {
  const { data, error } = await client
    .from("external_events")
    .select(EVENT_COLUMNS)
    .order("starts_at", { ascending: false, nullsFirst: false });

  if (error !== null) throw new Error(`listAllCachedEvents failed: ${error.message}`);
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
 * Queue the events a refresh saw finish (E23.13). A second sighting of the same
 * event is a no-op — the primary key is the "exactly once".
 */
export async function recordCompletions(
  serviceClient: SupabaseClient,
  source: EventSource,
  events: readonly { readonly externalId: string; readonly name: string }[],
  detectedAt: string,
): Promise<void> {
  if (events.length === 0) return;

  const { error } = await serviceClient.from("event_completions").upsert(
    events.map((event) => ({
      source,
      external_id: event.externalId,
      name: event.name,
      detected_at: detectedAt,
    })),
    { onConflict: "source,external_id", ignoreDuplicates: true },
  );

  if (error !== null) throw new Error(`recordCompletions failed: ${error.message}`);
}

export interface CompletionClaim {
  readonly limit: number;
  /** A lease taken before this can be taken again: its runner is presumed dead. */
  readonly leaseCutoff: string;
  readonly maxAttempts: number;
  /** One calendar only, for a runner that can only handle that source. */
  readonly source?: EventSource;
}

/** Take up to `limit` unprocessed completions, oldest first, for this runner alone. */
export async function claimCompletions(
  serviceClient: SupabaseClient,
  claim: CompletionClaim,
): Promise<readonly EventCompletion[]> {
  const { data, error } = await serviceClient
    .rpc("claim_event_completions", {
      max_rows: claim.limit,
      lease_cutoff: claim.leaseCutoff,
      max_attempts: claim.maxAttempts,
      only_source: claim.source ?? null,
    })
    .select(COMPLETION_COLUMNS);

  if (error !== null) throw new Error(`claimCompletions failed: ${error.message}`);
  return (data as unknown as CompletionRow[]).map(toCompletion);
}

/** Done: this event's results are never fetched again. */
export async function markCompletionProcessed(
  serviceClient: SupabaseClient,
  completion: Pick<EventCompletion, "source" | "externalId">,
  processedAt: string,
): Promise<void> {
  const { error } = await serviceClient
    .from("event_completions")
    .update({ processed_at: processedAt, claimed_at: null, last_error: null })
    .eq("source", completion.source)
    .eq("external_id", completion.externalId);

  if (error !== null) throw new Error(`markCompletionProcessed failed: ${error.message}`);
}

/** Failed this time: release the lease and say why. `attempts` was counted by the claim. */
export async function markCompletionFailed(
  serviceClient: SupabaseClient,
  completion: Pick<EventCompletion, "source" | "externalId">,
  error: string,
): Promise<void> {
  const { error: updateError } = await serviceClient
    .from("event_completions")
    .update({ claimed_at: null, last_error: error })
    .eq("source", completion.source)
    .eq("external_id", completion.externalId);

  if (updateError !== null) throw new Error(`markCompletionFailed failed: ${updateError.message}`);
}

/**
 * The queue as an admin sees it (`/admin/processing`): waiting events first,
 * then the most recently seen. Takes the admin's own client —
 * `event_completions_admin_all` decides.
 */
export async function listCompletions(
  client: SupabaseClient,
  limit: number,
): Promise<readonly EventCompletion[]> {
  const { data, error } = await client
    .from("event_completions")
    .select(COMPLETION_COLUMNS)
    .order("processed_at", { ascending: false, nullsFirst: true })
    .order("detected_at", { ascending: false })
    .limit(limit);

  if (error !== null) throw new Error(`listCompletions failed: ${error.message}`);
  return (data as unknown as CompletionRow[]).map(toCompletion);
}

/**
 * Send every finished tournament round the queue again, backfilling complete
 * calendar events that were never queued. Returns how many are now waiting.
 * The admin's own client; an event a runner holds right now keeps its lease.
 */
export async function requeueAllCompletions(
  client: SupabaseClient,
  source?: EventSource,
): Promise<number> {
  const { data, error } = await client.rpc("requeue_event_completions", {
    only_source: source ?? null,
  });

  if (error !== null) throw new Error(`requeueAllCompletions failed: ${error.message}`);
  return data as number;
}

/**
 * PostgREST's `in` takes a parenthesised list, and a value containing a comma or
 * a quote would otherwise end the list early. Challonge ids are numeric strings,
 * but a second source's need not be.
 */
function asInList(values: readonly string[]): string {
  return `(${values.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")})`;
}
