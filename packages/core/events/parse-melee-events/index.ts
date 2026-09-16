import type { ExternalEventState, ParsedExternalEvent } from "@ps/contracts";

/** Where a tournament id resolves to. melee.gg has no slug in this payload. */
const MELEE_WEB_BASE = "https://melee.gg/Tournament/View";

/** The organisers' marker for a bracket they are wiring up, same as on Challonge. */
const TEST_EVENT_MARKER = "[TEST]";

/**
 * melee's `StatusDescription`, reduced to the three states a schedule shows.
 *
 * Matched on the description rather than the numeric `Status`, because the
 * numbers are only knowable by observation — 1, 3 and 4 have been seen and
 * nothing documents the rest — while the words say what they mean.
 */
const STATES: Readonly<Record<string, ExternalEventState>> = {
  registration: "scheduled",
  scheduled: "scheduled",
  notstarted: "scheduled",
  inprogress: "live",
  started: "live",
  ended: "complete",
  completed: "complete",
};

/** A cancelled event is not on the calendar at all. It is not "finished". */
const CANCELLED = new Set(["canceled", "cancelled"]);

/**
 * The melee.gg tournament-list payload to canonical events.
 *
 * Tolerant in the same way `parse-challonge-events` is, and for the same reason:
 * this runs against a third party's JSON inside a page render, so a member whose
 * shape has changed costs that member and not the page.
 */
export function parseMeleeEvents(payload: unknown): readonly ParsedExternalEvent[] {
  const events: ParsedExternalEvent[] = [];

  for (const member of contentOf(payload)) {
    const event = parseMember(member);
    if (event !== null) events.push(event);
  }

  return events;
}

function contentOf(payload: unknown): readonly unknown[] {
  if (!isRecord(payload)) return [];
  const content = payload["Content"];
  return Array.isArray(content) ? content : [];
}

function parseMember(member: unknown): ParsedExternalEvent | null {
  if (!isRecord(member)) return null;

  const externalId = asId(member["ID"]);
  const name = asString(member["Name"])?.trim();
  if (externalId === null || name === undefined || name === "" || name.includes(TEST_EVENT_MARKER))
    return null;

  const status = normalise(asString(member["StatusDescription"]));
  if (CANCELLED.has(status)) return null;

  return {
    source: "melee",
    externalId,
    name,
    url: `${MELEE_WEB_BASE}/${externalId}`,
    state: STATES[status] ?? "scheduled",
    // The list payload carries no scheduled start time — only the last time a
    // round was paired, which is null until the event begins. For a finished
    // event that is within a round of when it ran, which is close enough to sort
    // and to age out of the past window; for one still in registration it is
    // null, and the card says "date to be announced" rather than inventing one.
    startsAt: asString(member["LastPairDateTime"]),
    // Not in this payload. The card hides a count of zero rather than showing it.
    participantCount: 0,
    structure: structureOf(member["Phases"]),
  };
}

/**
 * The phase names, which are the closest thing melee gives to a bracket shape:
 * "swiss", or "swiss + top 8 playoffs" for an event with a cut.
 */
function structureOf(value: unknown): string | null {
  if (!Array.isArray(value)) return null;

  const names = value
    .filter(isRecord)
    .sort((a, b) => asOrder(a["SortOrder"]) - asOrder(b["SortOrder"]))
    .map((phase) =>
      asString(phase["Name"])
        ?.trim()
        .replace(/\s+phase$/i, "")
        .toLowerCase(),
    )
    .filter((name): name is string => name !== undefined && name !== "");

  return names.length === 0 ? null : names.join(" + ");
}

/** `ID` is a number in every payload seen; the cache key is text either way. */
function asId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const text = asString(value)?.trim();
  return text === undefined || text === "" ? null : text;
}

function normalise(value: string | null): string {
  return (value ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

function asOrder(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
