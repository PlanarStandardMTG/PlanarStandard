import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseChallongeEvents } from "./index";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../../fixtures/challonge-api/${name}`, import.meta.url), "utf8"));

describe("core/events/parse-challonge-events", () => {
  it("parses the community list payload exactly as the fixture expects", () => {
    expect(parseChallongeEvents(fixture("community-tournaments.json"))).toEqual(
      fixture("community-tournaments.expected.json"),
    );
  });

  it("drops the organisers' [TEST] brackets", () => {
    const names = parseChallongeEvents(fixture("community-tournaments.json")).map((e) => e.name);

    expect(names.some((name) => name.includes("[TEST]"))).toBe(false);
  });

  it("skips a member with no name and keeps the rest of the batch", () => {
    const events = parseChallongeEvents({
      data: [
        { id: "1", attributes: { state: "pending" } },
        { id: "2", attributes: { name: "Real Event", state: "pending" } },
      ],
    });

    expect(events.map((e) => e.externalId)).toEqual(["2"]);
  });

  it("shows an event whose state nobody has seen before rather than hiding it", () => {
    const [event] = parseChallongeEvents({
      data: [{ id: "1", attributes: { name: "Something New", state: "seeding" } }],
    });

    expect(event?.state).toBe("scheduled");
  });

  it("treats every mid-flight Challonge state as live", () => {
    const states = ["underway", "awaiting_review", "group_stages_underway", "group_stages_finalized"];
    const events = parseChallongeEvents({
      data: states.map((state, i) => ({ id: String(i), attributes: { name: state, state } })),
    });

    expect(events.map((e) => e.state)).toEqual(["live", "live", "live", "live"]);
  });

  it("leaves an already-absolute url alone and prefixes a slug", () => {
    const events = parseChallongeEvents({
      data: [
        { id: "1", attributes: { name: "Slug", state: "pending", url: "ps_weekly_41" } },
        { id: "2", attributes: { name: "Absolute", state: "pending", url: "https://challonge.com/x/y" } },
        { id: "3", attributes: { name: "Blank", state: "pending", url: "  " } },
      ],
    });

    expect(events.map((e) => e.url)).toEqual([
      "https://challonge.com/ps_weekly_41",
      "https://challonge.com/x/y",
      null,
    ]);
  });

  it("reports no participants rather than a negative or fractional count", () => {
    const events = parseChallongeEvents({
      data: [
        { id: "1", attributes: { name: "A", state: "pending", participants_count: -3 } },
        { id: "2", attributes: { name: "B", state: "pending", participants_count: 12.7 } },
        { id: "3", attributes: { name: "C", state: "pending", participants_count: "24" } },
      ],
    });

    expect(events.map((e) => e.participantCount)).toEqual([0, 12, 0]);
  });

  it("returns nothing at all for a payload that is not the expected envelope", () => {
    expect(parseChallongeEvents(null)).toEqual([]);
    expect(parseChallongeEvents({ errors: [{ title: "Unauthorized" }] })).toEqual([]);
    expect(parseChallongeEvents({ data: "not-an-array" })).toEqual([]);
  });
});
