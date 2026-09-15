import type { IsoDateTime } from "@ps/contracts";

/**
 * How long a fetch of the event calendar is good for.
 *
 * Two hours, and the arithmetic is the reason: Challonge allows 500 requests a
 * month, which is about sixteen a day. A refresh every two hours costs twelve a
 * day — 360 a month — leaving room for a job, a manual refresh, and the pages of
 * a busy weekend. Five minutes would cost 288 a day and exhaust the month's
 * budget in under two days of ordinary traffic.
 *
 * This is the only number to change if the budget or the appetite for staleness
 * changes, and the site is honest about it: `/events` shows how old the cache is.
 */
export const EVENT_SYNC_INTERVAL_MS = 2 * 60 * 60 * 1000;

/**
 * Is a refresh due?
 *
 * `lastAttemptedAt` and not `lastSucceededAt` is the input on purpose. Measuring
 * from the last success means an outage turns every page view into another
 * request against a monthly budget; measuring from the attempt costs one request
 * per window whether it worked or not.
 */
export function isSyncDue(
  lastAttemptedAt: IsoDateTime | null,
  now: Date,
  intervalMs: number = EVENT_SYNC_INTERVAL_MS,
): boolean {
  if (lastAttemptedAt === null) return true;

  const attempted = Date.parse(lastAttemptedAt);
  // An unparseable timestamp is a row we cannot reason about. Refreshing is the
  // recoverable failure; never refreshing again is not.
  if (Number.isNaN(attempted)) return true;

  return now.getTime() - attempted >= intervalMs;
}

/**
 * The instant a claim compares against: anything attempted before this is stale.
 *
 * Exists so the comparison the repository runs in SQL and the one this module
 * runs in TypeScript are the same arithmetic, written once.
 */
export function syncCutoff(now: Date, intervalMs: number = EVENT_SYNC_INTERVAL_MS): IsoDateTime {
  return new Date(now.getTime() - intervalMs).toISOString();
}
