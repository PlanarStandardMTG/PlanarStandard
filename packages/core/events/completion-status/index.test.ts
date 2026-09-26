import type { EventCompletion } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { COMPLETION_LEASE_MS, COMPLETION_MAX_ATTEMPTS, completionStatus } from "./index";

const NOW = new Date("2026-09-25T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

const completion = (over: Partial<EventCompletion> = {}): EventCompletion => ({
  source: "melee",
  externalId: "1",
  name: "Weekly",
  detectedAt: ago(60_000),
  claimedAt: null,
  processedAt: null,
  attempts: 0,
  lastError: null,
  elo: true,
  decklists: false,
  ...over,
});

describe("core/events/completion-status", () => {
  it("is waiting when untouched, and processed once done", () => {
    expect(completionStatus(completion(), NOW)).toBe("waiting");
    expect(completionStatus(completion({ processedAt: ago(1) }), NOW)).toBe("processed");
  });

  it("is running while a lease holds, and not once it has run out", () => {
    expect(completionStatus(completion({ claimedAt: ago(1000), attempts: 1 }), NOW)).toBe(
      "running",
    );
    expect(
      completionStatus(completion({ claimedAt: ago(COMPLETION_LEASE_MS + 1), attempts: 1 }), NOW),
    ).toBe("retrying");
  });

  it("is excluded on neither line until processed", () => {
    expect(completionStatus(completion({ elo: false }), NOW)).toBe("excluded");
    expect(completionStatus(completion({ elo: false, decklists: true }), NOW)).toBe("waiting");
    expect(completionStatus(completion({ elo: false, processedAt: ago(1) }), NOW)).toBe(
      "processed",
    );
  });

  it("gives up after the last attempt", () => {
    expect(completionStatus(completion({ attempts: COMPLETION_MAX_ATTEMPTS }), NOW)).toBe(
      "gave-up",
    );
  });
});
