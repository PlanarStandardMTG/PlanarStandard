import { describe, expect, it } from "vitest";

import { suggestRounds } from "./index";

describe("core/runs/suggest-rounds", () => {
  it.each([
    // MTR Appendix E, constructed, at both ends of each row.
    [9, 5, 4],
    [16, 5, 4],
    [17, 5, 8],
    [32, 5, 8],
    [33, 6, 8],
    [64, 6, 8],
    [65, 7, 8],
    [128, 7, 8],
    [129, 8, 8],
    [226, 8, 8],
    [227, 9, 8],
    [409, 9, 8],
    [410, 10, 8],
    [1000, 10, 8],
  ])("suggests Appendix E's row for %i entrants", (entrants, swissRounds, topCut) => {
    expect(suggestRounds(entrants)).toEqual({ swissRounds, topCut });
  });

  it.each([5, 8])(
    "suggests three Swiss rounds and no cut for %i entrants, where Appendix E would run single elimination",
    (entrants) => {
      expect(suggestRounds(entrants)).toEqual({ swissRounds: 3, topCut: 0 });
    },
  );

  it("suggests something playable below Appendix E's table", () => {
    expect(suggestRounds(4)).toEqual({ swissRounds: 3, topCut: 0 });
    expect(suggestRounds(3)).toEqual({ swissRounds: 3, topCut: 0 });
    expect(suggestRounds(2)).toEqual({ swissRounds: 1, topCut: 0 });
    expect(suggestRounds(1)).toEqual({ swissRounds: 0, topCut: 0 });
    expect(suggestRounds(0)).toEqual({ swissRounds: 0, topCut: 0 });
  });
});
