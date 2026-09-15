import { describe, expect, it } from "vitest";

import { dateAttribute, formatDate, formatDateTime, formatTimeAgo } from "./format-date";

const NOW = new Date("2026-09-15T12:00:00.000Z");

describe("lib/format-date", () => {
  it("renders a date the same way regardless of where it runs", () => {
    expect(formatDate("2026-09-11T20:00:00Z")).toBe("11 September 2026");
    expect(dateAttribute("2026-09-11T20:00:00Z")).toBe("2026-09-11");
  });

  it("labels an event time as UTC, in the zone it was written in", () => {
    // 20:00Z is 21:00 in London in September. Showing 21:00 would move the event.
    expect(formatDateTime("2026-09-11T20:00:00Z")).toBe("Fri 11 Sept, 20:00 UTC");
  });

  it("gives the roughest useful unit for how stale the cache is", () => {
    const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

    expect(formatTimeAgo(ago(20_000), NOW)).toBe("just now");
    expect(formatTimeAgo(ago(60_000), NOW)).toBe("1 minute ago");
    expect(formatTimeAgo(ago(25 * 60_000), NOW)).toBe("25 minutes ago");
    expect(formatTimeAgo(ago(2 * 3_600_000), NOW)).toBe("2 hours ago");
    expect(formatTimeAgo(ago(50 * 3_600_000), NOW)).toBe("2 days ago");
  });

  it("says so rather than printing NaN for a timestamp it cannot read", () => {
    expect(formatTimeAgo("not a date", NOW)).toBe("at an unknown time");
  });
});
