import { describe, expect, it } from "vitest";

import { seasonProgress } from "./index";

const season = { startsOn: "2026-07-01", endsOn: "2026-09-22" } as const;

describe("core/events/season-progress", () => {
  it("counts weeks from the opening day", () => {
    expect(seasonProgress(season, new Date("2026-07-01T12:00:00Z"))).toEqual({
      week: 1,
      weeks: 12,
    });
    expect(seasonProgress(season, new Date("2026-07-08T00:00:00Z"))).toEqual({
      week: 2,
      weeks: 12,
    });
  });

  it("includes the last day, which ends inclusive", () => {
    expect(seasonProgress(season, new Date("2026-09-22T23:00:00Z"))).toEqual({
      week: 12,
      weeks: 12,
    });
  });

  it("is null outside the season", () => {
    expect(seasonProgress(season, new Date("2026-06-30T23:59:00Z"))).toBeNull();
    expect(seasonProgress(season, new Date("2026-09-23T00:00:00Z"))).toBeNull();
  });

  it("has no total for an open-ended season", () => {
    const open = { startsOn: "2026-07-01", endsOn: null };
    expect(seasonProgress(open, new Date("2026-08-01T00:00:00Z"))).toEqual({
      week: 5,
      weeks: null,
    });
  });
});
