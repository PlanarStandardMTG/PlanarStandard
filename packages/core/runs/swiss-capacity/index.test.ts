import { describe, expect, it } from "vitest";

import { suggestRounds } from "../suggest-rounds/index";
import { maxSwissRounds } from "./index";

describe("core/runs/swiss-capacity", () => {
  it("lets an even field play everyone else once", () => {
    expect(maxSwissRounds(2)).toBe(1);
    expect(maxSwissRounds(4)).toBe(3);
    expect(maxSwissRounds(8)).toBe(7);
  });

  it("gives an odd field one more round, for each player's one bye", () => {
    expect(maxSwissRounds(3)).toBe(3);
    expect(maxSwissRounds(5)).toBe(5);
  });

  it("allows no rounds below two players", () => {
    expect(maxSwissRounds(1)).toBe(0);
    expect(maxSwissRounds(0)).toBe(0);
  });

  it("covers what suggest-rounds prefills, for every field", () => {
    for (let players = 2; players <= 64; players += 1) {
      expect(suggestRounds(players).swissRounds).toBeLessThanOrEqual(maxSwissRounds(players));
    }
  });
});
