import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseMeleeEvents } from "./index";

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(new URL(`../../../../fixtures/melee-api/${name}`, import.meta.url), "utf8"),
  );

const one = (member: Record<string, unknown>) => parseMeleeEvents({ Content: [member] })[0];

describe("core/events/parse-melee-events", () => {
  it("parses the captured tournament list exactly as the fixture expects", () => {
    expect(parseMeleeEvents(fixture("tournament-list.json"))).toEqual(
      fixture("tournament-list.expected.json"),
    );
  });

  it("drops a cancelled tournament rather than calling it finished", () => {
    // Two of the six in the capture are cancelled, and one of those is named
    // "test" — a cancelled bracket is not on the calendar in any state.
    const ids = parseMeleeEvents(fixture("tournament-list.json")).map((e) => e.externalId);

    expect(ids).not.toContain("450185");
    expect(ids).not.toContain("467208");
  });

  it("reads the cut as part of the structure", () => {
    expect(
      one({ ID: 1, Name: "Champs", Phases: [{ Name: "Swiss Phase", SortOrder: 1 }] })?.structure,
    ).toBe("swiss");
    expect(
      one({
        ID: 1,
        Name: "Champs",
        Phases: [
          { Name: "Top 8 Playoffs", SortOrder: 2 },
          { Name: "Swiss Phase", SortOrder: 1 },
        ],
      })?.structure,
      // Ordered by `SortOrder`, not by the order the payload happened to list
      // them in — "top 8 playoffs + swiss" would describe a different event.
    ).toBe("swiss + top 8 playoffs");
  });

  it("leaves an unstarted event undated instead of inventing a start time", () => {
    // The list payload has no scheduled start; `LastPairDateTime` is null until
    // the first round is paired. `event-schedule` sorts an undated event last
    // within its group rather than dropping it.
    const event = one({ ID: 1, Name: "Open", StatusDescription: "Registration" });

    expect(event).toMatchObject({ state: "scheduled", startsAt: null });
  });

  it("skips a member with no id or no name and keeps the rest of the batch", () => {
    const events = parseMeleeEvents({
      Content: [
        { ID: 1, StatusDescription: "Registration" },
        { Name: "No Id", StatusDescription: "Registration" },
        { ID: 3, Name: "Real Event", StatusDescription: "Registration" },
      ],
    });

    expect(events.map((e) => e.externalId)).toEqual(["3"]);
  });

  it("shows an event whose status nobody has seen before rather than hiding it", () => {
    expect(one({ ID: 1, Name: "Something New", StatusDescription: "Seeding" })?.state).toBe(
      "scheduled",
    );
  });

  it("matches a status however melee spaces or cases it", () => {
    expect(one({ ID: 1, Name: "Live", StatusDescription: "In Progress" })?.state).toBe("live");
    expect(one({ ID: 2, Name: "Also Live", StatusDescription: "inprogress" })?.state).toBe("live");
    expect(one({ ID: 3, Name: "Gone", StatusDescription: "Cancelled" })).toBeUndefined();
  });

  it("drops the organisers' [TEST] brackets, as on the other calendar", () => {
    expect(
      one({ ID: 1, Name: "[TEST] Weekly", StatusDescription: "Registration" }),
    ).toBeUndefined();
  });

  it("survives a payload that is not the shape it expects", () => {
    expect(parseMeleeEvents(null)).toEqual([]);
    expect(parseMeleeEvents({ Content: "nope" })).toEqual([]);
    expect(parseMeleeEvents({})).toEqual([]);
  });
});
