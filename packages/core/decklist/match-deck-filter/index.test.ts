import type { CardDataset, OracleCard, OracleId, ResolvedCard, ResolvedDeck } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { buildCardIndex } from "../../legality/build-card-index/index";
import { matchesDeckFilter, type DeckFilter } from "./index";

const card = (name: string, manaCost: string | null, typeLine: string, extra = {}): OracleCard => ({
  oracleId: `oracle:${name}` as OracleId,
  name,
  manaCost,
  manaValue: 0,
  colorIdentity: [],
  typeLine,
  oracleText: null,
  layout: "normal",
  setCodes: ["fdn"],
  ...extra,
});

const ORACLE: readonly OracleCard[] = [
  card("Llanowar Elves", "{G}", "Creature — Elf Druid"),
  card("Shock", "{R}", "Instant"),
  card("Forest", null, "Basic Land — Forest"),
  card("Karplusan Forest", null, "Land", { colorIdentity: ["R", "G"] }),
  card("Kitchen Finks", "{1}{G/W}{G/W}", "Creature — Ouphe"),
  card("Gitaxian Probe", "{U/P}", "Sorcery"),
  card("Bloomvine Regent // Claim Territory", null, "Creature — Dragon // Sorcery", {
    layout: "modal_dfc",
    faces: [
      {
        name: "Bloomvine Regent",
        manaCost: "{3}{G}{G}",
        manaValue: 5,
        typeLine: "",
        oracleText: null,
      },
      { name: "Claim Territory", manaCost: "{2}{B}", manaValue: 3, typeLine: "", oracleText: null },
    ],
  }),
];

const INDEX = buildCardIndex({
  oracle: ORACLE,
  printings: [],
  meta: {} as CardDataset["meta"],
});

function deckOf(...lines: readonly (readonly [string, ResolvedCard["board"]?])[]): ResolvedDeck {
  const cards = lines.map(([name, board = "main"], i) => ({
    qty: 1,
    name,
    oracleId: ORACLE.some((c) => c.name === name) ? (`oracle:${name}` as OracleId) : null,
    foil: false,
    board,
    lineNumber: i + 1,
  }));
  return { cards, issues: [], hasUnresolvedCards: cards.some((c) => c.oracleId === null) };
}

const filter = (colors: DeckFilter["colors"], cards: DeckFilter["cards"] = []): DeckFilter => ({
  colors,
  cards,
});

describe("core/decklist/match-deck-filter", () => {
  const gruul = deckOf(["Llanowar Elves"], ["Shock"], ["Forest"], ["Karplusan Forest"]);

  it("passes everything when nothing is chosen", () => {
    expect(matchesDeckFilter(gruul, INDEX, filter([]))).toBe(true);
  });

  it("needs every chosen colour in a spell's cost", () => {
    expect(matchesDeckFilter(gruul, INDEX, filter(["R", "G"]))).toBe(true);
    expect(matchesDeckFilter(gruul, INDEX, filter(["G", "W"]))).toBe(false);
  });

  it("ignores lands, whatever colours they make", () => {
    const lands = deckOf(["Karplusan Forest"], ["Forest"]);
    expect(matchesDeckFilter(lands, INDEX, filter(["G"]))).toBe(false);
  });

  it("counts a sideboard card's name but not its colour", () => {
    const deck = deckOf(["Llanowar Elves"], ["Shock", "side"]);
    expect(matchesDeckFilter(deck, INDEX, filter(["R"]))).toBe(false);
    expect(matchesDeckFilter(deck, INDEX, filter([], ["shock"]))).toBe(true);
  });

  it("counts hybrid, Phyrexian and each face's cost", () => {
    const deck = deckOf(
      ["Kitchen Finks"],
      ["Gitaxian Probe"],
      ["Bloomvine Regent // Claim Territory"],
    );
    expect(matchesDeckFilter(deck, INDEX, filter(["W", "U", "B", "G"]))).toBe(true);
    expect(matchesDeckFilter(deck, INDEX, filter(["R"]))).toBe(false);
  });

  it("needs every name, matched in part and without case or punctuation", () => {
    expect(matchesDeckFilter(gruul, INDEX, filter([], ["llanowar", "SHOCK"]))).toBe(true);
    expect(matchesDeckFilter(gruul, INDEX, filter([], ["Llanowar Elves", "Kitchen Finks"]))).toBe(
      false,
    );
    expect(matchesDeckFilter(gruul, INDEX, filter([], ["", "  "]))).toBe(true);
  });

  it("matches a face's name, and an unresolved line by what was written", () => {
    const deck = deckOf(["Bloomvine Regent // Claim Territory"], ["Some Unknown Card"]);
    expect(matchesDeckFilter(deck, INDEX, filter([], ["claim territory", "unknown card"]))).toBe(
      true,
    );
  });
});
