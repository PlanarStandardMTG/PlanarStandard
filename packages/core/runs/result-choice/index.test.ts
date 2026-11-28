import { describe, expect, it } from "vitest";

import { gamesFromChoice, resultChoices } from "./index";

describe("core/runs/result-choice", () => {
  it("stores a result from player 1's side, whoever reported it", () => {
    expect(gamesFromChoice("2-1-0", "p1", false)).toEqual({ p1Wins: 2, p2Wins: 1, draws: 0 });
    expect(gamesFromChoice("2-1-0", "p2", false)).toEqual({ p1Wins: 1, p2Wins: 2, draws: 0 });
  });

  it("offers an intentional draw as 0–0–3 in Swiss (MTR §2.5)", () => {
    expect(gamesFromChoice("0-0-3", "p2", false)).toEqual({ p1Wins: 0, p2Wins: 0, draws: 3 });
  });

  it("offers no draw in the top cut (MTR §2.4)", () => {
    expect(resultChoices(true).every((c) => c.won !== c.lost)).toBe(true);
    expect(gamesFromChoice("1-1-1", "p1", true)).toBeNull();
    expect(gamesFromChoice("0-0-3", "p1", true)).toBeNull();
    expect(gamesFromChoice("2-0-0", "p1", true)).toEqual({ p1Wins: 2, p2Wins: 0, draws: 0 });
  });

  it("refuses a code it does not offer", () => {
    expect(gamesFromChoice("3-0-0", "p1", false)).toBeNull();
    expect(gamesFromChoice("", "p1", false)).toBeNull();
  });
});
