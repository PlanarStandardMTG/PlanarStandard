import type { ExternalEventState, ParsedExternalEvent } from "@ps/contracts";

/** What the cache knew about an event before this refresh. */
export interface CachedEventState {
  readonly externalId: string;
  readonly state: ExternalEventState;
}

/**
 * The events this refresh sees reach `complete` (E23.13): complete now, and
 * either absent from the cache or in another state before it.
 *
 * Compared against the cache *before* it is replaced — afterwards every complete
 * event looks like it always was. An event already complete in the cache is
 * never returned again, so a tournament that ended is noticed once however many
 * refreshes still list it.
 */
export function newlyCompleted(
  previous: readonly CachedEventState[],
  fetched: readonly ParsedExternalEvent[],
): readonly ParsedExternalEvent[] {
  const before = new Map(previous.map((event) => [event.externalId, event.state]));
  return fetched.filter(
    (event) => event.state === "complete" && before.get(event.externalId) !== "complete",
  );
}
