import type { EventSource, EventSyncState, ExternalEvent } from "@ps/contracts";

/**
 * The `external_events` and `external_event_syncs` rows as PostgREST returns
 * them. Kept next to the mappers: outside this module an event is an
 * `ExternalEvent`, and the snake_case shape of the tables is nobody else's
 * business.
 */
export interface ExternalEventRow {
  readonly id: string;
  readonly source: string;
  readonly external_id: string;
  readonly name: string;
  readonly url: string | null;
  readonly state: ExternalEvent["state"];
  readonly starts_at: string | null;
  readonly participant_count: number;
  readonly structure: string | null;
  readonly fetched_at: string;
}

export interface SyncRow {
  readonly source: string;
  readonly last_attempted_at: string | null;
  readonly last_succeeded_at: string | null;
  readonly last_error: string | null;
  readonly event_count: number;
}

export const EVENT_COLUMNS =
  "id, source, external_id, name, url, state, starts_at, participant_count, structure, fetched_at";

export const SYNC_COLUMNS = "source, last_attempted_at, last_succeeded_at, last_error, event_count";

export function toExternalEvent(row: ExternalEventRow): ExternalEvent {
  return {
    id: row.id,
    source: row.source as EventSource,
    externalId: row.external_id,
    name: row.name,
    url: row.url,
    state: row.state,
    startsAt: row.starts_at,
    participantCount: row.participant_count,
    structure: row.structure,
    fetchedAt: row.fetched_at,
  };
}

export function toSyncState(row: SyncRow): EventSyncState {
  return {
    source: row.source as EventSource,
    lastAttemptedAt: row.last_attempted_at,
    lastSucceededAt: row.last_succeeded_at,
    lastError: row.last_error,
    eventCount: row.event_count,
  };
}
