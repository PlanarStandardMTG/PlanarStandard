import type { CalendarFetch } from "@/lib/events/calendar-fetch";

/**
 * The only module in the repo that talks to melee.gg (E23.12).
 *
 * `.server.ts` is load-bearing: `scripts/check-server-only.ts` (E1.7) fails CI if
 * anything reachable from a `'use client'` module imports this file. The
 * credentials are production secrets held in Vercel — no contributor needs them,
 * nothing in `packages/` may read them, and a machine without them must still get
 * a working page. That is why unset credentials are a result and not an error.
 */

const API_URL = "https://melee.gg/api/tournament/list";

/** As with Challonge: a slow third party must not hang a page render. */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * melee.gg's own default page size, echoed back as `PageSize`. Four pages is far
 * more than the organisation runs in a season, and `HasMore` ends the loop long
 * before the cap in practice.
 */
const PAGE_SIZE = 25;
const MAX_PAGES = 4;

interface MeleeCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

function credentials(): MeleeCredentials | null {
  const clientId = process.env["MELEE_CLIENT_ID"];
  const clientSecret = process.env["MELEE_CLIENT_SECRET"];

  if (
    clientId === undefined ||
    clientId === "" ||
    clientSecret === undefined ||
    clientSecret === ""
  )
    return null;
  return { clientId, clientSecret };
}

/** Whether a refresh is even possible here. The page uses this to explain itself. */
export function isMeleeConfigured(): boolean {
  return credentials() !== null;
}

/**
 * Fetch the organisation's tournament list.
 *
 * Never throws, for the same reason the Challonge client does not: the caller is
 * a page render, and a third party being down is not a reason for the site to be.
 * Pages are concatenated into one `Content` envelope so the parser sees exactly
 * the shape the fixture holds.
 */
export async function fetchTournamentList(): Promise<CalendarFetch> {
  const creds = credentials();
  if (creds === null) return { status: "not-configured" };

  const content: unknown[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await fetchPage(creds, page);
    if (result.status !== "ok") return result;

    content.push(...contentOf(result.payload));
    // The endpoint says outright whether there is another page, so — unlike
    // Challonge, where a short page is the signal — there is nothing to infer.
    if (!hasMore(result.payload)) break;
  }

  return { status: "ok", payload: { Content: content } };
}

async function fetchPage(creds: MeleeCredentials, page: number): Promise<CalendarFetch> {
  // `page` and `pageSize` are the names the response echoes back as `Page` and
  // `PageSize`. Unverified beyond the first page: the organisation has six
  // tournaments, so `HasMore` has never yet been true.
  const url = `${API_URL}?page=${page}&pageSize=${PAGE_SIZE}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${basicAuth(creds)}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      return { status: "failed", error: `melee responded ${response.status}` };
    }

    const payload: unknown = await response.json();

    // melee reports its own status inside the body as well as in the HTTP status,
    // and the two need not agree. A body saying 401 under a 200 envelope is a
    // failed fetch and not an empty calendar — treating it as the latter would
    // prune every cached melee.gg event on the replace that followed.
    const bodyStatus = statusCodeOf(payload);
    if (bodyStatus !== null && bodyStatus !== 200) {
      return { status: "failed", error: `melee responded ${bodyStatus} in the payload` };
    }

    return { status: "ok", payload };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause);
    return { status: "failed", error: `melee request failed: ${error}` };
  }
}

function basicAuth(creds: MeleeCredentials): string {
  return btoa(`${creds.clientId}:${creds.clientSecret}`);
}

function contentOf(payload: unknown): readonly unknown[] {
  if (!isRecord(payload)) return [];
  const content = payload["Content"];
  return Array.isArray(content) ? content : [];
}

function hasMore(payload: unknown): boolean {
  return isRecord(payload) && payload["HasMore"] === true;
}

function statusCodeOf(payload: unknown): number | null {
  if (!isRecord(payload)) return null;
  const status = payload["StatusCode"];
  return typeof status === "number" ? status : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
