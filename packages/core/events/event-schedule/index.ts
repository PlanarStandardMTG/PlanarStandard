import type { EventSchedule, ExternalEvent } from "@ps/contracts";

/**
 * How long a finished event stays on the schedule.
 *
 * Long enough that someone who missed last weekend can still find the bracket,
 * short enough that the page is about what is coming up. The full history is the
 * tournaments section's job, not this page's.
 */
export const PAST_EVENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Cached events, grouped and ordered the way the schedule reads.
 *
 * Live first — it is the only group anyone can still act on this minute — then
 * upcoming soonest-first, then the recent past newest-first.
 *
 * An event Challonge still calls scheduled whose start time has passed is
 * treated as live. Organisers routinely start a bracket without flipping its
 * state, and a permanently "upcoming" event from three weeks ago at the top of
 * the page is the previous site's most visible bug.
 */
export function eventSchedule(
  events: readonly ExternalEvent[],
  now: Date,
  pastWindowMs: number = PAST_EVENT_WINDOW_MS,
): EventSchedule {
  const live: ExternalEvent[] = [];
  const upcoming: ExternalEvent[] = [];
  const past: ExternalEvent[] = [];
  const horizon = now.getTime() - pastWindowMs;

  for (const event of events) {
    const startsAt = startTime(event);

    if (event.state === "complete") {
      if (startsAt === null || startsAt >= horizon) past.push(event);
      continue;
    }

    if (event.state === "live" || (startsAt !== null && startsAt <= now.getTime())) {
      live.push(event);
      continue;
    }

    upcoming.push(event);
  }

  return {
    live: live.sort(bySoonest),
    upcoming: upcoming.sort(bySoonest),
    past: past.sort(byMostRecent),
  };
}

/**
 * An undated event sorts last within its group rather than being dropped. A
 * bracket the organiser has not scheduled yet is still worth advertising.
 */
function bySoonest(a: ExternalEvent, b: ExternalEvent): number {
  const left = startTime(a);
  const right = startTime(b);
  if (left === right) return a.name.localeCompare(b.name);
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

function byMostRecent(a: ExternalEvent, b: ExternalEvent): number {
  const left = startTime(a);
  const right = startTime(b);
  if (left === right) return a.name.localeCompare(b.name);
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
}

function startTime(event: ExternalEvent): number | null {
  if (event.startsAt === null) return null;
  const parsed = Date.parse(event.startsAt);
  return Number.isNaN(parsed) ? null : parsed;
}
