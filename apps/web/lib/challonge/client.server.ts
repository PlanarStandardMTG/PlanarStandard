import type { CalendarFetch } from "@/lib/events/calendar-fetch";

import { challongeGetAllPages } from "./transport.server";

/**
 * The community's tournament calendar from Challonge (E23.7). A tournament's
 * name, dates and state name no one, so this list leaves `lib/challonge/` as
 * Challonge sent it; results do not, and go through `results.server.ts`.
 */

export { isChallongeConfigured } from "./transport.server";

/** Pages of the tournaments list. 50 × 4 is far more events than the community runs at once. */
const PAGE_SIZE = 50;
const MAX_PAGES = 4;

/**
 * Fetch the community's tournament list.
 *
 * Never throws: the caller is a page render, and a third party being down is not
 * a reason for the site to be.
 */
export async function fetchCommunityTournaments(): Promise<CalendarFetch> {
  return challongeGetAllPages("/tournaments.json", {
    pageSize: PAGE_SIZE,
    maxPages: MAX_PAGES,
  });
}
