import { describe, expect, it } from "vitest";

import { runScheduleEntry } from "./index";

const run = {
  id: "r1",
  name: "Weekly #42",
  startsAt: "2026-10-17T19:00:00.000Z",
  state: "registration" as const,
  swissRounds: 3,
  topCut: 8,
};

describe("core/runs/schedule-entry", () => {
  it("lists a run open for registration as upcoming, linking to its page in /play", () => {
    expect(runScheduleEntry(run, 12, "now")).toEqual({
      id: "r1",
      source: "site",
      externalId: "r1",
      name: "Weekly #42",
      url: "/play/runs/r1",
      state: "scheduled",
      startsAt: "2026-10-17T19:00:00.000Z",
      participantCount: 12,
      structure: "swiss + top 8",
      fetchedAt: "now",
    });
  });

  it("shows a run being played as live and a finished one as complete", () => {
    expect(runScheduleEntry({ ...run, state: "running" }, 0, "now")?.state).toBe("live");
    expect(runScheduleEntry({ ...run, state: "top_cut" }, 0, "now")?.state).toBe("live");
    expect(runScheduleEntry({ ...run, state: "finished" }, 0, "now")?.state).toBe("complete");
  });

  it("leaves drafts and cancelled runs off the schedule", () => {
    expect(runScheduleEntry({ ...run, state: "draft" }, 0, "now")).toBeNull();
    expect(runScheduleEntry({ ...run, state: "cancelled" }, 0, "now")).toBeNull();
  });

  it("names the structure the way the platforms' events do", () => {
    expect(runScheduleEntry({ ...run, topCut: 0 }, 0, "now")?.structure).toBe("swiss");
    expect(runScheduleEntry({ ...run, swissRounds: 0 }, 0, "now")?.structure).toBe(
      "single elimination",
    );
  });
});
