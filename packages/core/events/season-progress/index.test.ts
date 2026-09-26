import { describe, expect, it } from "vitest";

import { seasonProgress } from "./index";

const season = { startsOn: "2026-01-15", endsOn: "2026-12-31" } as const;

describe("core/events/season-progress", () => {
  it("counts calendar months from the opening day", () => {
    expect(seasonProgress(season, new Date("2026-01-15T12:00:00Z"))).toEqual({
      month: 1,
      months: 12,
    });
    expect(seasonProgress(season, new Date("2026-02-14T00:00:00Z"))).toEqual({
      month: 1,
      months: 12,
    });
    expect(seasonProgress(season, new Date("2026-02-15T00:00:00Z"))).toEqual({
      month: 2,
      months: 12,
    });
  });

  it("includes the last day, which ends inclusive", () => {
    expect(seasonProgress(season, new Date("2026-12-31T23:00:00Z"))).toEqual({
      month: 12,
      months: 12,
    });
  });

  it("is null outside the season", () => {
    expect(seasonProgress(season, new Date("2026-01-14T23:59:00Z"))).toBeNull();
    expect(seasonProgress(season, new Date("2027-01-01T00:00:00Z"))).toBeNull();
  });

  it("counts a short season in the months it touches", () => {
    const short = { startsOn: "2026-07-01", endsOn: "2026-09-22" };
    expect(seasonProgress(short, new Date("2026-08-10T00:00:00Z"))).toEqual({
      month: 2,
      months: 3,
    });
  });

  it("has no total for an open-ended season", () => {
    const open = { startsOn: "2026-01-01", endsOn: null };
    expect(seasonProgress(open, new Date("2026-05-20T00:00:00Z"))).toEqual({
      month: 5,
      months: null,
    });
  });
});
