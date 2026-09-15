import type { ExternalEventState, ParsedExternalEvent } from "@ps/contracts";

/** Where a bare `url` slug resolves to. Challonge redirects community slugs here. */
const CHALLONGE_WEB_BASE = "https://challonge.com";

/**
 * Organisers wire up brackets on the live community before an event. The
 * previous site hid them by this marker and so does this one — it is a
 * convention the organisers already follow, not something to migrate them off.
 */
const TEST_EVENT_MARKER = "[TEST]";

/**
 * Challonge's own states, reduced to the three a schedule shows.
 *
 * `awaiting_review` is an event whose results are being finalised: not upcoming,
 * not yet official. It reads as live, which is also how the previous site
 * grouped it. The two group-stage states are a bracket mid-flight.
 */
const STATES: Readonly<Record<string, ExternalEventState>> = {
  pending: "scheduled",
  underway: "live",
  awaiting_review: "live",
  group_stages_underway: "live",
  group_stages_finalized: "live",
  complete: "complete",
};

/**
 * The v2.1 community-tournaments payload to canonical events.
 *
 * Tolerant by design. This runs against a third party's JSON on a five-figure
 * request budget, so one member Challonge has changed the shape of costs that
 * member and not the page: anything without an id and a name is skipped, and an
 * unrecognised `state` still produces an event rather than swallowing it.
 * Showing an event in the wrong group is a smaller failure than not showing it.
 */
export function parseChallongeEvents(payload: unknown): readonly ParsedExternalEvent[] {
  const members = membersOf(payload);
  const events: ParsedExternalEvent[] = [];

  for (const member of members) {
    const event = parseMember(member);
    if (event !== null) events.push(event);
  }

  return events;
}

function membersOf(payload: unknown): readonly unknown[] {
  if (!isRecord(payload)) return [];
  const data = payload["data"];
  return Array.isArray(data) ? data : [];
}

function parseMember(member: unknown): ParsedExternalEvent | null {
  if (!isRecord(member)) return null;

  const externalId = asString(member["id"]);
  const attributes = member["attributes"];
  if (externalId === null || !isRecord(attributes)) return null;

  const name = asString(attributes["name"])?.trim();
  if (name === undefined || name === "" || name.includes(TEST_EVENT_MARKER)) return null;

  const rawState = asString(attributes["state"]) ?? "";

  return {
    source: "challonge",
    externalId,
    name,
    url: resolveUrl(asString(attributes["url"])),
    state: STATES[rawState] ?? "scheduled",
    startsAt: asString(attributes["starts_at"]),
    participantCount: asCount(attributes["participants_count"]),
    structure: asString(attributes["tournament_type"]),
  };
}

/**
 * `url` is normally a slug, but the API has been seen returning an absolute URL
 * for a community tournament. Prefixing one of those would produce a dead link.
 */
function resolveUrl(url: string | null): string | null {
  if (url === null || url.trim() === "") return null;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${CHALLONGE_WEB_BASE}/${trimmed.replace(/^\/+/, "")}`;
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
