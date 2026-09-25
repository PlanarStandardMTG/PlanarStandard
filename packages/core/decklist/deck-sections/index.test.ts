import { describe, expect, it } from "vitest";

import { deckSections, sectionOf } from "./index";

describe("core/decklist/deck-sections", () => {
  it("puts a card in one section by its front face, land first", () => {
    expect(sectionOf("Basic Land — Swamp")).toBe("land");
    expect(sectionOf("Artifact Land")).toBe("land");
    expect(sectionOf("Artifact Creature — Golem")).toBe("creature");
    expect(sectionOf("Legendary Planeswalker — Ugin")).toBe("planeswalker");
    expect(sectionOf("Kindred Instant — Elf")).toBe("instant");
    expect(sectionOf("Creature — Dragon // Instant — Omen")).toBe("creature");
    expect(sectionOf("Legendary Enchantment Artifact")).toBe("artifact");
    expect(sectionOf("Conspiracy")).toBe("other");
  });

  it("never guesses a section for an unresolved card", () => {
    expect(sectionOf(null)).toBe("unknown");
  });

  it("groups the maindeck by type and the sideboard whole, in reading order", () => {
    const types: Record<string, string> = {
      Swamp: "Basic Land — Swamp",
      Negate: "Instant",
      Bear: "Creature — Bear",
    };
    const cards = [
      { name: "Swamp", qty: 20, board: "main" as const },
      { name: "Negate", qty: 2, board: "main" as const },
      { name: "Bear", qty: 4, board: "main" as const },
      { name: "Bear", qty: 1, board: "side" as const },
      { name: "Nonsense", qty: 1, board: "main" as const },
    ];

    const sections = deckSections(cards, (card) => types[card.name] ?? null);

    expect(sections.map((s) => [s.key, s.count])).toEqual([
      ["creature", 4],
      ["instant", 2],
      ["land", 20],
      ["unknown", 1],
      ["sideboard", 1],
    ]);
  });

  it("returns nothing for an empty deck", () => {
    expect(deckSections([], () => null)).toEqual([]);
  });
});
