import type { CalendarFetch } from "@/lib/events/calendar-fetch";

import { challongeGetAllPages } from "./transport.server";

/**
 * The community's tournament calendar from Challonge (E23.7). A tournament's
 * name, dates and state name no one, so this list leaves `lib/challonge/` as
 * Challonge sent it; results do not, and go through `results.server.ts`.
 */

export { isChallongeConfigured } from "./transport.server";

/**
 * One request, newest-created first (seen against the live API): a refresh spends one
 * request of the 500 a month, however many events the community has run. Older events
 * stay in the cache — see `replaceEvents`' `prune`.
 */
const PAGE_SIZE = 100;
const MAX_PAGES = 1;

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
