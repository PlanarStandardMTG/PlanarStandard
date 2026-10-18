import type { DeckTraits } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { matchesDeckFilter, type DeckFilter } from "./index";

const traits = (
  castColors: DeckTraits["castColors"],
  cardNames: DeckTraits["cardNames"] = [],
): Pick<DeckTraits, "castColors" | "cardNames"> => ({ castColors, cardNames });

const filter = (colors: DeckFilter["colors"], cards: DeckFilter["cards"] = []): DeckFilter => ({
  colors,
  cards,
});

describe("core/decklist/match-deck-filter", () => {
  const gruul = traits(["R", "G"], ["forest", "karplusan forest", "llanowar elves", "shock"]);

  it("passes everything when nothing is chosen", () => {
    expect(matchesDeckFilter(gruul, filter([]))).toBe(true);
    expect(matchesDeckFilter(traits([]), filter([]))).toBe(true);
  });

  it("needs every chosen colour among the ones it casts", () => {
    expect(matchesDeckFilter(gruul, filter(["R", "G"]))).toBe(true);
    expect(matchesDeckFilter(gruul, filter(["G", "W"]))).toBe(false);
  });

  it("needs every name, matched in part and without case or punctuation", () => {
    expect(matchesDeckFilter(gruul, filter([], ["llanowar", "SHOCK!"]))).toBe(true);
    expect(matchesDeckFilter(gruul, filter([], ["Llanowar Elves", "Kitchen Finks"]))).toBe(false);
    expect(matchesDeckFilter(gruul, filter([], ["", "  "]))).toBe(true);
  });

  it("matches a face's name inside a two-faced card's", () => {
    const deck = traits(["B", "G"], ["bloomvine regent // claim territory"]);
    expect(matchesDeckFilter(deck, filter([], ["Claim Territory"]))).toBe(true);
  });

  it("needs the colours and the names together", () => {
    expect(matchesDeckFilter(gruul, filter(["R"], ["shock"]))).toBe(true);
    expect(matchesDeckFilter(gruul, filter(["W"], ["shock"]))).toBe(false);
  });
});
