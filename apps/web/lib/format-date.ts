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
