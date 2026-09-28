import type { IsoDate, RatingWindow } from "@ps/contracts";

/**
 * The dates Elo replays (E25.6): read from an admin's form, and asked of an
 * event's date. Both ends are inclusive; no `until` runs to the newest event.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const isDate = (value: string) =>
  DATE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

/** A window from the form's two fields, or what is wrong with them. */
export function parseRatingWindow(
  from: string,
  until: string,
): { ok: true; window: RatingWindow } | { ok: false; error: string } {
  const start = from.trim();
  const end = until.trim();
  if (start === "") return { ok: false, error: "Choose a start date." };
  if (!isDate(start)) return { ok: false, error: "The start date is not a date." };
  if (end === "") return { ok: true, window: { from: start, until: null } };
  if (!isDate(end)) return { ok: false, error: "The end date is not a date." };
  if (end < start) return { ok: false, error: "The end date is before the start date." };
  return { ok: true, window: { from: start, until: end } };
}

export function inRatingWindow(date: IsoDate, window: RatingWindow): boolean {
  return date >= window.from && (window.until === null || date <= window.until);
}
