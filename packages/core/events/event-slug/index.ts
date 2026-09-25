/**
 * A tournament's URL key, from its name. `attempt` is for the caller's retry
 * when `tournaments.slug` is taken.
 */
export function eventSlug(name: string, attempt = 1): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "event";
  return attempt <= 1 ? base : `${base}-${attempt}`;
}
