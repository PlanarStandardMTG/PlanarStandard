import type { CalendarFetch } from "@/lib/events/calendar-fetch";
import { describeFetchFailure } from "@/lib/fetch-failure";

/**
 * The only code in the repo that sends a request to Challonge (E23.7, E12.13).
 *
 * **Private to `lib/challonge/`.** `.dependency-cruiser.cjs` fails CI if anything
 * outside this directory imports it: a participants response carries names,
 * emails and more, and these functions return it untouched. The rest of the site
 * reads Challonge through `client.server.ts` and `results.server.ts`, each of
 * which decides what leaves.
 *
 * `.server.ts` is load-bearing too: `scripts/check-server-only.ts` (E1.7) fails
 * CI if anything reachable from a `'use client'` module imports this file. The API
 * key is a production secret held in Vercel — no contributor needs it, nothing in
 * `packages/` may read it, and a machine without it must still get a working
 * site. That is why unset credentials are a result and not an error.
 */

/** Community tournaments, v2.1. The community is a slug, not an id. */
const API_BASE = "https://api.challonge.com/v2.1";

/** Challonge has been slow enough to hang a page render. A refresh is not worth that. */
const REQUEST_TIMEOUT_MS = 8000;

/** What every request hands back — the calendar's `CalendarFetch`, for any endpoint. */
export type ChallongeFetch = CalendarFetch;

interface ChallongeCredentials {
  readonly apiKey: string;
  readonly community: string;
}

function credentials(): ChallongeCredentials | null {
  const apiKey = process.env["CHALLONGE_API_KEY"];
  const community = process.env["CHALLONGE_COMMUNITY"];

  if (apiKey === undefined || apiKey === "" || community === undefined || community === "")
    return null;
  return { apiKey, community };
}

/** Whether a request is even possible here. */
export function isChallongeConfigured(): boolean {
  return credentials() !== null;
}

/**
 * Pages of a collection under the community, concatenated into one JSON:API
 * `data` envelope so a parser sees exactly the shape a single response holds.
 *
 * A short page, or `links.next: null`, is the last one: asking again would spend
 * a request from a 500-a-month budget to learn nothing. `per_page` is honoured
 * up to at least a hundred (seen against the live API while wiring E12.13 up).
 */
export async function challongeGetAllPages(
  path: string,
  { pageSize, maxPages }: { readonly pageSize: number; readonly maxPages: number },
): Promise<ChallongeFetch> {
  const members: unknown[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const result = await challongeGet(path, { page: String(page), per_page: String(pageSize) });
    if (result.status !== "ok") return result;

    // A response with no `data` list is not an empty page: read as one, it would
    // empty the calendar, or report an event as having no matches.
    const batch = dataOf(result.payload);
    if (batch === null)
      return { status: "failed", error: "challonge returned a page with no data" };
    members.push(...batch);

    if (batch.length < pageSize || isLastPage(result.payload)) break;
  }

  return { status: "ok", payload: { data: members } };
}

/**
 * One GET under `/communities/{community}`. Never throws: a caller may be a page
 * render, and a third party being down is not a reason for the site to be. The
 * body is never logged; an error names a status, not data.
 */
export async function challongeGet(
  path: string,
  query: Readonly<Record<string, string>> = {},
): Promise<ChallongeFetch> {
  const creds = credentials();
  if (creds === null) return { status: "not-configured" };

  const url = new URL(`${API_BASE}/communities/${encodeURIComponent(creds.community)}${path}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        // v2.1 accepts a v1 API key under these two headers. The alternative is
        // the OAuth dance the previous site ran, which needs a user to consent —
        // there is no user here, only a scheduled read.
        "Authorization-Type": "v1",
        Authorization: creds.apiKey,
        Accept: "application/json",
        // v2.1 is a JSON:API implementation and answers 415 to a request that
        // does not declare this, even a GET with no body.
        "Content-Type": "application/vnd.api+json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // Never into Next's data cache: a raw response is not ours to keep.
      cache: "no-store",
    });

    if (!response.ok) {
      return { status: "failed", error: `challonge responded ${response.status}` };
    }

    return { status: "ok", payload: await response.json() };
  } catch (cause) {
    return { status: "failed", error: `challonge request failed: ${describeFetchFailure(cause)}` };
  }
}

function isLastPage(payload: unknown): boolean {
  const links = (payload as Record<string, unknown>)["links"];
  return (
    typeof links === "object" &&
    links !== null &&
    (links as Record<string, unknown>)["next"] === null
  );
}

function dataOf(payload: unknown): readonly unknown[] | null {
  if (typeof payload !== "object" || payload === null) return null;
  const data = (payload as Record<string, unknown>)["data"];
  return Array.isArray(data) ? data : null;
}
