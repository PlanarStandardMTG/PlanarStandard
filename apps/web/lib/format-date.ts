/**
 * Dates render identically on the server and in the browser.
 *
 * A locale-dependent format would differ between the two and trip React's
 * hydration check, so the locale and time zone are both pinned.
 */
const FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(iso: string): string {
  return FORMAT.format(new Date(iso));
}

/** `2026-09-11T20:00:00Z` → `2026-09-11`, for a `<time dateTime>` attribute. */
export function dateAttribute(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * A date with a time, for anything the reader has to turn up to.
 *
 * UTC and explicitly labelled. The alternative — the visitor's own zone —
 * differs between the server render and the browser, which is a hydration
 * mismatch, and the community already writes its schedules in UTC.
 */
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

export function formatDateTime(iso: string): string {
  return `${DATE_TIME_FORMAT.format(new Date(iso))} UTC`;
}

/**
 * How long ago something happened, in the roughest useful unit.
 *
 * `now` is an argument so the output is a function of its inputs — the caller is
 * a server render, and the value must not change between two calls in one pass.
 */
export function formatTimeAgo(iso: string, now: Date): string {
  const elapsedMs = now.getTime() - Date.parse(iso);
  if (!Number.isFinite(elapsedMs)) return "at an unknown time";

  const minutes = Math.round(elapsedMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
