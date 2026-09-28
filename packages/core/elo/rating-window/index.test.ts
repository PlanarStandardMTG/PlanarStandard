import { describe, expect, it } from "vitest";

import { inRatingWindow, parseRatingWindow } from "./index";

describe("core/elo/rating-window", () => {
  it("reads a window, leaving the end open when it is blank", () => {
    expect(parseRatingWindow("2026-01-21", "")).toEqual({
      ok: true,
      window: { from: "2026-01-21", until: null },
    });
    expect(parseRatingWindow(" 2026-01-21 ", "2026-04-18")).toEqual({
      ok: true,
      window: { from: "2026-01-21", until: "2026-04-18" },
    });
  });

  it("refuses a missing start, a non-date, and an end before the start", () => {
    expect(parseRatingWindow("", "")).toMatchObject({ ok: false, error: "Choose a start date." });
    expect(parseRatingWindow("2026-02-30", "")).toMatchObject({ ok: false });
    expect(parseRatingWindow("2026-01-21", "soon")).toMatchObject({ ok: false });
    expect(parseRatingWindow("2026-04-18", "2026-01-21")).toMatchObject({
      ok: false,
      error: "The end date is before the start date.",
    });
  });

  it("includes both end dates", () => {
    const window = { from: "2026-01-21", until: "2026-04-18" };
    expect(inRatingWindow("2026-01-21", window)).toBe(true);
    expect(inRatingWindow("2026-04-18", window)).toBe(true);
    expect(inRatingWindow("2026-01-20", window)).toBe(false);
    expect(inRatingWindow("2026-04-19", window)).toBe(false);
  });

  it("runs an open window to any later date", () => {
    expect(inRatingWindow("2031-12-31", { from: "2026-01-21", until: null })).toBe(true);
  });
});
