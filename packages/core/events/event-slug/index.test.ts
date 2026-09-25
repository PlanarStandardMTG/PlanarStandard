import { describe, expect, it } from "vitest";

import { eventSlug } from "./index";

describe("core/events/event-slug", () => {
  it("hyphenates a tournament name", () => {
    expect(eventSlug("Monthly Championship Series - September 2026")).toBe(
      "monthly-championship-series-september-2026",
    );
    expect(eventSlug("Legality Fracture #1 ")).toBe("legality-fracture-1");
  });

  it("falls back to a word when nothing survives", () => {
    expect(eventSlug("★")).toBe("event");
  });

  it("numbers a retry from 2", () => {
    expect(eventSlug("Weekly #3", 2)).toBe("weekly-3-2");
  });
});
