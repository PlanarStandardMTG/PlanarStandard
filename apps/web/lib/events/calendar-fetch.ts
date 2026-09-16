/**
 * What a calendar client hands back, whichever calendar it is.
 *
 * A types-only leaf: both clients import it and nothing here imports them, which
 * is what keeps `lib/events` → `lib/<platform>` a one-way edge. The shape is the
 * reason the coordinator has no per-source branch — it claims a window, calls a
 * fetch, and reads `status`, and `challonge` and `melee` differ only in which
 * function it called.
 */
export type CalendarFetch =
  | { readonly status: "ok"; readonly payload: unknown }
  /** No credentials configured. Every contributor's machine, and not a failure. */
  | { readonly status: "not-configured" }
  | { readonly status: "failed"; readonly error: string };
