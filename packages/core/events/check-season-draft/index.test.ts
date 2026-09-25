import type { IsoDate } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { checkSeasonDraft, type SeasonSpan } from "./index";

const draft = (over: Partial<Parameters<typeof checkSeasonDraft>[0]> = {}) => ({
  name: "Season IV",
  startsOn: "2027-01-02",
  endsOn: "2027-04-30",
  isCurrent: false,
  ...over,
});

const season = (name: string, startsOn: string, endsOn: string | null): SeasonSpan => ({
  name,
  startsOn: startsOn as IsoDate,
  endsOn: endsOn as IsoDate | null,
});

const SEASON_II = season("Season II", "2026-05-09", "2026-08-29");

describe("core/events/check-season-draft", () => {
  it("accepts a well-formed season, trimmed, with a blank end as open-ended", () => {
    expect(checkSeasonDraft(draft({ name: "  Season IV ", endsOn: "" }), [SEASON_II])).toEqual({
      ok: true,
      value: { name: "Season IV", startsOn: "2027-01-02", endsOn: null, isCurrent: false },
    });
  });

  it("needs a name and a start date", () => {
    const check = checkSeasonDraft(draft({ name: " ", startsOn: "soon" }), []);

    expect(check.ok === false && check.problems).toEqual([
      { field: "name", code: "empty" },
      { field: "startsOn", code: "invalid" },
    ]);
  });

  it("refuses an end before the start", () => {
    const check = checkSeasonDraft(draft({ endsOn: "2026-12-31" }), []);

    expect(check.ok === false && check.problems).toEqual([
      { field: "endsOn", code: "before-start" },
    ]);
  });

  it("refuses a season sharing a day with another, ends inclusive", () => {
    const check = checkSeasonDraft(draft({ startsOn: "2026-08-29", endsOn: "2026-09-10" }), [
      SEASON_II,
    ]);

    expect(check.ok === false && check.problems).toEqual([
      { field: "startsOn", code: "overlap", season: "Season II" },
    ]);
  });

  it("treats an open-ended season as running forever, either way round", () => {
    const open = season("Season III", "2026-09-26", null);

    expect(checkSeasonDraft(draft(), [open]).ok).toBe(false);
    expect(checkSeasonDraft(draft({ startsOn: "2026-09-01", endsOn: "" }), [SEASON_II]).ok).toBe(
      true,
    );
    expect(checkSeasonDraft(draft({ startsOn: "2026-01-01", endsOn: "" }), [SEASON_II]).ok).toBe(
      false,
    );
  });

  it("accepts a season that ends the day before the next begins", () => {
    expect(
      checkSeasonDraft(draft({ startsOn: "2026-09-01", endsOn: "2026-09-25" }), [
        SEASON_II,
        season("Season III", "2026-09-26", null),
      ]).ok,
    ).toBe(true);
  });
});
