import type { CardDataset, OracleCard, OracleId, ResolvedCard, ResolvedDeck } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { buildCardIndex } from "../../legality/build-card-index/index";
import { deckTraits } from "./index";

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
  card("Llanowar Elves", "{G}", "Creature — Elf Druid", { colorIdentity: ["G"] }),
  card("Shock", "{R}", "Instant", { colorIdentity: ["R"] }),
  card("Forest", null, "Basic Land — Forest", { colorIdentity: ["G"] }),
  card("Karplusan Forest", null, "Land", { colorIdentity: ["R", "G"] }),
  card("Plains", null, "Basic Land — Plains", { colorIdentity: ["W"] }),
  card("Kitchen Finks", "{1}{G/W}{G/W}", "Creature — Ouphe", { colorIdentity: ["G", "W"] }),
  card("Gitaxian Probe", "{U/P}", "Sorcery", { colorIdentity: ["U"] }),
  card("Bloomvine Regent // Claim Territory", null, "Creature — Dragon // Sorcery", {
    layout: "modal_dfc",
    colorIdentity: ["B", "G"],
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

describe("core/decklist/deck-traits", () => {
  it("reads the pips from the maindeck's identity, lands included", () => {
    const deck = deckOf(["Llanowar Elves"], ["Plains"], ["Shock", "side"]);
    expect(deckTraits(deck, INDEX).colors).toStrictEqual(["W", "G"]);
  });

  it("casts only what a spell's cost names, on every board", () => {
    const deck = deckOf(["Llanowar Elves"], ["Karplusan Forest"], ["Plains"], ["Shock", "side"]);
    expect(deckTraits(deck, INDEX).castColors).toStrictEqual(["R", "G"]);
  });

  it("counts hybrid, Phyrexian and each face's cost", () => {
    const deck = deckOf(
      ["Kitchen Finks"],
      ["Gitaxian Probe"],
      ["Bloomvine Regent // Claim Territory"],
    );
    expect(deckTraits(deck, INDEX).castColors).toStrictEqual(["W", "U", "B", "G"]);
  });

  it("names every card once, normalized, and an unresolved line by what was written", () => {
    const deck = deckOf(
      ["Bloomvine Regent // Claim Territory"],
      ["Shock"],
      ["Shock", "side"],
      ["Some Unknown Card!"],
    );
    expect(deckTraits(deck, INDEX).cardNames).toStrictEqual([
      "bloomvine regent // claim territory",
      "shock",
      "some unknown card",
    ]);
  });

  it("has no colours and no names for an empty list", () => {
    expect(deckTraits(deckOf(), INDEX)).toStrictEqual({
      colors: [],
      castColors: [],
      cardNames: [],
    });
  });
});
