import type { ExternalEvent } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { PAST_EVENT_WINDOW_MS, eventSchedule } from "./index";

const NOW = new Date("2026-09-15T12:00:00.000Z");

const event = (over: Partial<ExternalEvent> & { name: string }): ExternalEvent => ({
  id: `id-${over.name}`,
  source: "challonge",
  externalId: `x-${over.name}`,
  url: null,
  state: "scheduled",
  startsAt: null,
  participantCount: 0,
  structure: null,
  fetchedAt: NOW.toISOString(),
  ...over,
});

describe("core/events/event-schedule", () => {
  it("groups by state and orders each group for reading", () => {
    const schedule = eventSchedule(
      [
        event({ name: "later", startsAt: "2026-09-27T19:00:00.000Z" }),
        event({ name: "soon", startsAt: "2026-09-18T19:00:00.000Z" }),
        event({ name: "running", state: "live", startsAt: "2026-09-15T10:00:00.000Z" }),
        event({ name: "last week", state: "complete", startsAt: "2026-09-06T19:00:00.000Z" }),
        event({ name: "two weeks ago", state: "complete", startsAt: "2026-08-30T19:00:00.000Z" }),
      ],
      NOW,
    );

    expect(schedule.live.map((e) => e.name)).toEqual(["running"]);
    expect(schedule.upcoming.map((e) => e.name)).toEqual(["soon", "later"]);
    expect(schedule.past.map((e) => e.name)).toEqual(["last week", "two weeks ago"]);
  });

  it("treats a scheduled event whose start time has passed as live", () => {
    const schedule = eventSchedule(
      [event({ name: "started an hour ago", startsAt: "2026-09-15T11:00:00.000Z" })],
      NOW,
    );

    expect(schedule.live.map((e) => e.name)).toEqual(["started an hour ago"]);
    expect(schedule.upcoming).toEqual([]);
  });

  it("sorts an undated event last in its group rather than dropping it", () => {
    const schedule = eventSchedule(
      [event({ name: "undated" }), event({ name: "dated", startsAt: "2026-09-18T19:00:00.000Z" })],
      NOW,
    );

    expect(schedule.upcoming.map((e) => e.name)).toEqual(["dated", "undated"]);
  });

  it("keeps an undated finished event, which has no way to age out", () => {
    const schedule = eventSchedule([event({ name: "undated", state: "complete" })], NOW);

    expect(schedule.past.map((e) => e.name)).toEqual(["undated"]);
  });

  it("drops a finished event older than the window", () => {
    const ancient = new Date(NOW.getTime() - PAST_EVENT_WINDOW_MS - 1000).toISOString();
    const inside = new Date(NOW.getTime() - PAST_EVENT_WINDOW_MS + 1000).toISOString();

    const schedule = eventSchedule(
      [
        event({ name: "ancient", state: "complete", startsAt: ancient }),
        event({ name: "inside", state: "complete", startsAt: inside }),
      ],
      NOW,
    );

    expect(schedule.past.map((e) => e.name)).toEqual(["inside"]);
  });

  it("breaks a tie on name, so the order does not depend on what the cache returned", () => {
    const at = "2026-09-18T19:00:00.000Z";
    const schedule = eventSchedule(
      [event({ name: "Zephyr Cup", startsAt: at }), event({ name: "Ajani Open", startsAt: at })],
      NOW,
    );

    expect(schedule.upcoming.map((e) => e.name)).toEqual(["Ajani Open", "Zephyr Cup"]);
  });

  it("gives all three groups for an empty cache", () => {
    expect(eventSchedule([], NOW)).toEqual({ live: [], upcoming: [], past: [] });
  });

  it("does not mutate the array it was given", () => {
    const events = [
      event({ name: "later", startsAt: "2026-09-27T19:00:00.000Z" }),
      event({ name: "soon", startsAt: "2026-09-18T19:00:00.000Z" }),
    ];
    const before = events.map((e) => e.name);

    eventSchedule(events, NOW);

    expect(events.map((e) => e.name)).toEqual(before);
  });
});
