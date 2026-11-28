import type { RunPairing, RunRound } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { roundTitles } from "./index";

const round = (number: number, kind: RunRound["kind"]): RunRound => ({
  id: `r${number}`,
  runId: "run",
  number,
  kind,
  pairedAt: "x",
});

/** The first cut round of a top `size`: seeds paired off, top seeds on byes when it is short. */
function firstCutRound(number: number, size: number): RunPairing[] {
  const bracket = 2 ** Math.ceil(Math.log2(size));
  const byes = bracket - size;
  return Array.from({ length: byes + (size - byes) / 2 }, (_, i) => ({
    id: `p${i}`,
    roundId: `r${number}`,
    round: number,
    table: i + 1,
    p1EntrantId: `s${i + 1}`,
    p2EntrantId: i < byes ? null : `s${size - (i - byes)}`,
    games: null,
    status: "pending",
  }));
}

const swiss = [round(1, "swiss"), round(2, "swiss"), round(3, "swiss")];
const titles = (cutSize: number, cutRoundsPaired: number) => {
  const cut = Array.from({ length: cutRoundsPaired }, (_, i) => round(4 + i, "elimination"));
  return [...roundTitles([...swiss, ...cut], firstCutRound(4, cutSize)).values()];
};

describe("core/runs/round-title", () => {
  it("numbers Swiss rounds", () => {
    expect([...roundTitles(swiss, []).values()]).toEqual(["Round 1", "Round 2", "Round 3"]);
  });

  it("names a top 8's rounds Quarterfinals, Semifinals, Finals", () => {
    expect(titles(8, 3).slice(3)).toEqual(["Quarterfinals", "Semifinals", "Finals"]);
  });

  it("names a top 4's Semifinals and Finals, and a top 2's Finals", () => {
    expect(titles(4, 2).slice(3)).toEqual(["Semifinals", "Finals"]);
    expect(titles(2, 1).slice(3)).toEqual(["Finals"]);
  });

  it("names the cut by its bracket before every round is paired", () => {
    expect(titles(8, 1).slice(3)).toEqual(["Quarterfinals"]);
    expect(titles(6, 2).slice(3)).toEqual(["Quarterfinals", "Semifinals"]);
  });

  it("goes back to numbers for a cut longer than three rounds", () => {
    expect(titles(16, 4).slice(3)).toEqual(["Round 4", "Quarterfinals", "Semifinals", "Finals"]);
  });
});
