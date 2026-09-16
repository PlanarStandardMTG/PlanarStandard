import type { EventSource } from "@ps/contracts";

/**
 * What to call each calendar where the reader can see it.
 *
 * A `Record` rather than a function with a fallback: a new `EventSource` has to
 * be named here or the build fails, which is cheaper than shipping `melee` in
 * lower case to the front page. Capitalisation is each platform's own —
 * melee.gg writes itself that way.
 */
export const EVENT_SOURCE_LABELS: Record<EventSource, string> = {
  challonge: "Challonge",
  melee: "melee.gg",
};
