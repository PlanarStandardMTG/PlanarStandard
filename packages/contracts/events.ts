// A cached view of an external event calendar. Rows mirror `external_events` and
// `external_event_syncs`; `timestamptz` columns arrive as ISO 8601 strings.

import type { ExternalEventId, IsoDateTime } from "./primitives";

/**
 * Which calendar an event came from. One source, one row in the sync ledger.
 *
 * A source is a **calendar**, not a results platform. `melee` here is melee.gg's
 * tournament listing, and the same event's results arrive later through an
 * adapter (§9) that knows nothing about this table. The site's own view of what
 * is on is not per-platform, so nothing downstream of the cache branches on this
 * value except the label on a card.
 */
export type EventSource = "challonge" | "melee";

/**
 * Where an event is in its life, reduced to the three states a schedule can show.
 *
 * Sources use more states than this — Challonge alone has `awaiting_review` and
 * two group-stage states — but a visitor asking "can I still enter this" only
 * ever gets three answers. The mapping is the parser's job, so a second source
 * is a new parser and not a wider union here.
 */
export type ExternalEventState = "scheduled" | "live" | "complete";

/**
 * One event on the community calendar, as the site caches and shows it.
 *
 * Deliberately carries nothing Challonge-shaped: no participant ids, no bracket,
 * no registration state. This is a poster, not a tournament record — the
 * tournament record is `tournaments` (§13), which an import creates and which
 * this never writes to.
 */
export interface ExternalEvent {
  readonly id: ExternalEventId;
  readonly source: EventSource;
  /** The id in the source's own numbering. Unique per source, and the cache key. */
  readonly externalId: string;
  readonly name: string;
  /** Absolute URL of the event's own page. The primary action on every card. */
  readonly url: string | null;
  readonly state: ExternalEventState;
  /** Null when the organiser has not set a date. Such an event still gets shown. */
  readonly startsAt: IsoDateTime | null;
  readonly participantCount: number;
  /** The source's own words for the structure — "swiss", "single elimination". */
  readonly structure: string | null;
  /** When the payload this row came from was fetched, which is what "as of" means on the page. */
  readonly fetchedAt: IsoDateTime;
}

/**
 * An event as a source's payload describes it, before the cache gives it a row.
 *
 * A parser cannot know either of the two fields this drops: `id` is assigned by
 * Postgres, and `fetchedAt` is when the request came back, which is the caller's
 * fact and not the payload's. Keeping them out means the parser stays pure.
 */
export type ParsedExternalEvent = Omit<ExternalEvent, "id" | "fetchedAt">;

/**
 * The refresh ledger for one source — one row, forever.
 *
 * `lastAttemptedAt` and not `lastSucceededAt` is what the refresh interval is
 * measured against. Measuring from success means an outage turns every page view
 * into another request, which is exactly how a 500-a-month budget disappears in
 * an afternoon.
 */
export interface EventSyncState {
  readonly source: EventSource;
  readonly lastAttemptedAt: IsoDateTime | null;
  readonly lastSucceededAt: IsoDateTime | null;
  readonly lastError: string | null;
  readonly eventCount: number;
}

/** Cached events grouped for display. Empty arrays, not absent keys — every group renders. */
export interface EventSchedule {
  readonly live: readonly ExternalEvent[];
  readonly upcoming: readonly ExternalEvent[];
  readonly past: readonly ExternalEvent[];
}

/**
 * An `event_completions` row (E23.13): a tournament the calendar saw reach
 * `complete`, queued so that its results are fetched and processed exactly once.
 * `processedAt` set means it is never fetched again.
 */
export interface EventCompletion {
  readonly source: EventSource;
  readonly externalId: string;
  readonly name: string;
  readonly detectedAt: IsoDateTime;
  /** When a runner last took it. A lease: older than the cutoff, and it can be taken again. */
  readonly claimedAt: IsoDateTime | null;
  readonly processedAt: IsoDateTime | null;
  readonly attempts: number;
  readonly lastError: string | null;
  /** On the Elo line: its matches rate. A Monthly starts on it (E18.22). */
  readonly elo: boolean;
  /** On the decklist line: its lists are stored against its standings. A Monthly starts on it. */
  readonly decklists: boolean;
}
