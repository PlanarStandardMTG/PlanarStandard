import { describe, expect, it } from "vitest";

import { EVENT_SYNC_INTERVAL_MS, isSyncDue, syncCutoff } from "./index";

const NOW = new Date("2026-09-15T12:00:00.000Z");

describe("core/events/sync-window", () => {
  it("is always due for a source nobody has ever fetched", () => {
    expect(isSyncDue(null, NOW)).toBe(true);
  });

  it("is not due inside the interval and is due on its edge", () => {
    const oneHourAgo = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
    const exactly = new Date(NOW.getTime() - EVENT_SYNC_INTERVAL_MS).toISOString();

    expect(isSyncDue(oneHourAgo, NOW)).toBe(false);
    expect(isSyncDue(exactly, NOW)).toBe(true);
  });

  it("measures from the attempt, so a failing source costs one request per window", () => {
    const justFailed = new Date(NOW.getTime() - 60 * 1000).toISOString();

    expect(isSyncDue(justFailed, NOW)).toBe(false);
  });

  it("refreshes rather than seizing up on a timestamp it cannot parse", () => {
    expect(isSyncDue("not a date", NOW)).toBe(true);
  });

  it("takes now as an argument, so the same inputs always give the same answer", () => {
    const attempted = "2026-09-15T11:00:00.000Z";
    const later = new Date("2026-09-15T14:30:00.000Z");

    expect(isSyncDue(attempted, NOW)).toBe(false);
    expect(isSyncDue(attempted, later)).toBe(true);
  });

  it("honours a caller-supplied interval", () => {
    const fiveMinutesAgo = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();

    expect(isSyncDue(fiveMinutesAgo, NOW, 60 * 1000)).toBe(true);
    expect(isSyncDue(fiveMinutesAgo, NOW, 10 * 60 * 1000)).toBe(false);
  });

  it("gives the cutoff the claim compares against", () => {
    expect(syncCutoff(NOW)).toBe("2026-09-15T10:00:00.000Z");
    expect(syncCutoff(NOW, 60 * 1000)).toBe("2026-09-15T11:59:00.000Z");
  });

  it("agrees with isSyncDue on both sides of the cutoff", () => {
    const cutoff = syncCutoff(NOW);
    const justBefore = new Date(Date.parse(cutoff) - 1).toISOString();
    const justAfter = new Date(Date.parse(cutoff) + 1).toISOString();

    expect(isSyncDue(justBefore, NOW)).toBe(true);
    expect(isSyncDue(justAfter, NOW)).toBe(false);
  });

  it("keeps the interval inside the monthly request budget", () => {
    const perDay = (24 * 60 * 60 * 1000) / EVENT_SYNC_INTERVAL_MS;

    expect(perDay * 31).toBeLessThan(500);
  });
});
