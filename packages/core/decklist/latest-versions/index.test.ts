import { describe, expect, it } from "vitest";

import { latestVersions } from "./index";

const deck = (id: string, parentDeckId: string | null = null) => ({ id, parentDeckId });

describe("core/decklist/latest-versions", () => {
  it("keeps the newest version of each deck, in the order given, with its count", () => {
    const decks = [deck("c", "b"), deck("x"), deck("b", "a"), deck("a")];

    expect(latestVersions(decks)).toEqual([
      { deck: deck("c", "b"), versions: 3 },
      { deck: deck("x"), versions: 1 },
    ]);
  });

  it("counts only the versions it was given, when an ancestor is missing", () => {
    expect(latestVersions([deck("b", "a")])).toEqual([{ deck: deck("b", "a"), versions: 1 }]);
  });

  it("is empty for no decks", () => {
    expect(latestVersions([])).toEqual([]);
  });
});
