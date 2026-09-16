/**
 * The only module in the repo that talks to Challonge (E23.7).
 *
 * `.server.ts` is load-bearing: `scripts/check-server-only.ts` (E1.7) fails CI if
 * anything reachable from a `'use client'` module imports this file. The API key
 * is a production secret held in Vercel — no contributor needs it, nothing in
 * `packages/` may read it, and a machine without it must still get a working
 * site. That is why unset credentials are a result and not an error.
 */

/** Community tournaments, v2.1. The community is a slug, not an id. */
const API_BASE = "https://api.challonge.com/v2.1";

/** Challonge has been slow enough to hang a page render. A refresh is not worth that. */
const REQUEST_TIMEOUT_MS = 8000;

/** Pages of the tournaments list. 50 × 4 is far more events than the community runs at once. */
const PAGE_SIZE = 50;
const MAX_PAGES = 4;

export type ChallongeFetch =
  | { readonly status: "ok"; readonly payload: unknown }
  /** No key configured. Every contributor's machine, and not a failure. */
  | { readonly status: "not-configured" }
  | { readonly status: "failed"; readonly error: string };

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

/** Whether a refresh is even possible here. The page uses this to explain itself. */
export function isChallongeConfigured(): boolean {
  return credentials() !== null;
}

/**
 * Fetch the community's tournament list.
 *
 * Never throws: the caller is a page render, and a third party being down is not
 * a reason for the site to be. Pages are concatenated into one JSON:API-shaped
 * envelope so the parser sees exactly the shape the fixture holds.
 */
export async function fetchCommunityTournaments(): Promise<ChallongeFetch> {
  const creds = credentials();
  if (creds === null) return { status: "not-configured" };

  const members: unknown[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await fetchPage(creds, page);
    if (result.status !== "ok") return result;

    const batch = membersOf(result.payload);
    members.push(...batch);
    // A short page is the last page. Asking for one more would spend a request
    // from a 500-a-month budget to learn what this one already told us.
    if (batch.length < PAGE_SIZE) break;
  }

  return { status: "ok", payload: { data: members } };
}

async function fetchPage(creds: ChallongeCredentials, page: number): Promise<ChallongeFetch> {
  const url =
    `${API_BASE}/communities/${encodeURIComponent(creds.community)}/tournaments.json` +
    `?page=${page}&per_page=${PAGE_SIZE}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        // v2.1 accepts a v1 API key under these two headers. The alternative is
        // the OAuth dance the previous site ran, which needs a user to consent —
        // there is no user here, only a scheduled read of a public calendar.
        "Authorization-Type": "v1",
        Authorization: creds.apiKey,
        Accept: "application/json",
        // v2.1 is a JSON:API implementation and answers 415 to a request that
        // does not declare this, even a GET with no body.
        "Content-Type": "application/vnd.api+json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      return { status: "failed", error: `challonge responded ${response.status}` };
    }

    return { status: "ok", payload: await response.json() };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause);
    return { status: "failed", error: `challonge request failed: ${error}` };
  }
}

function membersOf(payload: unknown): readonly unknown[] {
  if (typeof payload !== "object" || payload === null) return [];
  const data = (payload as Record<string, unknown>)["data"];
  return Array.isArray(data) ? data : [];
}
