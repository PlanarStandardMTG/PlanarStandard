import type { CalendarFetch } from "@/lib/events/calendar-fetch";

import { isMeleeConfigured, meleeGetAllPages } from "./transport.server";

/**
 * melee.gg as a calendar (E23.12): the organisation's tournament list, which
 * names events and never players. Tournament *results* — which do name players —
 * are `results.server.ts`, scrubbed; the request itself is `transport.server.ts`.
 */

/** Whether a refresh is even possible here. The page uses this to explain itself. */
export { isMeleeConfigured };

/** A calendar is one organisation's events; four pages is years of them. */
const MAX_LIST_PAGES = 4;

/**
 * The organisation's tournament list. The credentials scope it: melee lists what
 * the authenticated staff member can see.
 */
export async function fetchTournamentList(): Promise<CalendarFetch> {
  return await meleeGetAllPages("/tournament/list", MAX_LIST_PAGES);
}
