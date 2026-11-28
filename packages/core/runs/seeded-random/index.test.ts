import { describe, expect, it } from "vitest";

import { seededRandom, seededShuffle } from "./index";

describe("core/runs/seeded-random", () => {
  it("gives the same stream for the same seed and a different one for another", () => {
    const draw = (seed: string) => Array.from({ length: 5 }, seededRandom(seed));

    expect(draw("3c9a7f21")).toEqual(draw("3c9a7f21"));
    expect(draw("3c9a7f21")).not.toEqual(draw("3c9a7f21:round:1"));
  });

  it("stays in [0, 1)", () => {
    const random = seededRandom("bounds");
    for (let i = 0; i < 1000; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("shuffles reproducibly without touching its input", () => {
    const entrants = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const shuffled = seededShuffle(entrants, "run-1:round:1");

    expect(shuffled).toEqual(seededShuffle(entrants, "run-1:round:1"));
    expect([...shuffled].sort()).toEqual(entrants);
    expect(entrants).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
  });

  it("pins the stream, so a stored seed re-pairs the same way after an upgrade", () => {
    expect(seededShuffle(["a", "b", "c", "d", "e"], "pinned")).toMatchInlineSnapshot(`
      [
        "b",
        "a",
        "d",
        "c",
        "e",
      ]
    `);
  });
});
