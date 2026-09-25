import type { CalendarFetch } from "@/lib/events/calendar-fetch";
import { describeFetchFailure } from "@/lib/fetch-failure";

/**
 * The only code in the repo that sends a request to melee.gg (E23.12, E12.10).
 *
 * **Private to `lib/melee/`.** `.dependency-cruiser.cjs` fails CI if anything
 * outside this directory imports it, because a raw melee response can carry
 * players' personal details and these functions return it untouched. The rest
 * of the site reads melee through the functions `client.server.ts` and
 * `results.server.ts` export, each of which decides what leaves.
 *
 * `.server.ts` is load-bearing too: `scripts/check-server-only.ts` (E1.7) fails
 * CI if anything reachable from a `'use client'` module imports this file. The
 * credentials are production secrets held in Vercel — no contributor needs them,
 * nothing in `packages/` may read them, and a machine without them must still get
 * a working page. That is why unset credentials are a result and not an error.
 *
 * The endpoints are from melee's Swagger document, `swagger/docs/v0.3.64.190`.
 */

const API_ROOT = "https://melee.gg/api";

/** As with Challonge: a slow third party must not hang a page render. */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * The paged endpoints take `variables.page` and `variables.pageSize` — the
 * Swagger names, and the only ones melee honours: sent as plain `pageSize` it
 * echoes back its default of 25. A hundred is honoured, which puts a whole
 * event's decklists in one request and its matches in one to three.
 */
const PAGE_SIZE = 100;

/** What every request hands back — the calendar's `CalendarFetch`, for any endpoint. */
export type MeleeFetch = CalendarFetch;

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

/** Whether a request is even possible here. */
export function isMeleeConfigured(): boolean {
  return credentials() !== null;
}

/**
 * Every page of a paged endpoint, concatenated into one `Content` envelope so a
 * parser sees exactly the shape a single response holds.
 */
export async function meleeGetAllPages(path: string, maxPages: number): Promise<MeleeFetch> {
  const content: unknown[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const result = await meleeGet(path, {
      "variables.page": String(page),
      "variables.pageSize": String(PAGE_SIZE),
    });
    if (result.status !== "ok") return result;

    // A page with no `Content` list is not an empty page: read as one, it would
    // empty the calendar, or report an event as having no matches.
    const items = contentOf(result.payload);
    if (items === null) return { status: "failed", error: "melee returned a page with no Content" };
    content.push(...items);

    // The endpoint says outright whether there is another page, so — unlike
    // Challonge, where a short page is the signal — there is nothing to infer.
    if (!hasMore(result.payload)) break;
  }

  return { status: "ok", payload: { Content: content } };
}

/**
 * One GET. Never throws, for the same reason the Challonge client does not: a
 * caller may be a page render, and a third party being down is not a reason for
 * the site to be. The body is never logged; an error names a status, not data.
 */
export async function meleeGet(
  path: string,
  query: Readonly<Record<string, string>> = {},
): Promise<MeleeFetch> {
  const creds = credentials();
  if (creds === null) return { status: "not-configured" };

  const url = new URL(`${API_ROOT}${path}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${basicAuth(creds)}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // Never into Next's data cache: a raw response is not ours to keep.
      cache: "no-store",
    });

    if (!response.ok) {
      return { status: "failed", error: `melee responded ${response.status}` };
    }

    const payload: unknown = await response.json();

    // melee reports its own status inside the body as well as in the HTTP status,
    // and the two need not agree. A body saying 401 under a 200 envelope is a
    // failed fetch and not an empty result — treating it as the latter would
    // prune every cached melee.gg event on the replace that followed.
    const bodyStatus = statusCodeOf(payload);
    if (bodyStatus !== null && bodyStatus !== 200) {
      return { status: "failed", error: `melee responded ${bodyStatus} in the payload` };
    }

    return { status: "ok", payload };
  } catch (cause) {
    return { status: "failed", error: `melee request failed: ${describeFetchFailure(cause)}` };
  }
}

function basicAuth(creds: MeleeCredentials): string {
  return btoa(`${creds.clientId}:${creds.clientSecret}`);
}

function contentOf(payload: unknown): readonly unknown[] | null {
  if (!isRecord(payload)) return null;
  const content = payload["Content"];
  return Array.isArray(content) ? content : null;
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
