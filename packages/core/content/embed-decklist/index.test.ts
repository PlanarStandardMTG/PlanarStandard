import { describe, expect, it } from "vitest";

import { decklistEmbed, type DecklistEmbedData } from "./index";

const context = { origin: "https://example.test" };
const id = "3f2a0000-0000-4000-8000-000000000001";
const deck: DecklistEmbedData = {
  name: "Rakdos Midrange",
  cards: [
    { quantity: 4, name: "Bloodtithe Harvester", board: "main" },
    { quantity: 56, name: "Swamp", board: "main" },
    { quantity: 2, name: "Duress", board: "side" },
  ],
};

describe("core/content/embed-decklist", () => {
  it("accepts a deck id, and refuses anything else", () => {
    expect(decklistEmbed.check({ id })).toBeNull();
    expect(decklistEmbed.check({})).toBe("needs a deck id");
    expect(decklistEmbed.check({ id: "rakdos" })).toBe("id must be a deck id");
  });

  it("gives Reddit a link and the list, indented so every line survives", () => {
    expect(decklistEmbed.exportAs("reddit", { id }, deck, context)).toBe(
      [
        `**[Rakdos Midrange](https://example.test/decks/${id})** · 60 cards, 2 sideboard`,
        "",
        "    4 Bloodtithe Harvester",
        "    56 Swamp",
        "",
        "    Sideboard",
        "    2 Duress",
      ].join("\n"),
    );
  });

  it("gives Discord the name, the count and the link", () => {
    expect(decklistEmbed.exportAs("discord", { id, title: "My list" }, deck, context)).toBe(
      `**My list** · 60 cards, 2 sideboard: https://example.test/decks/${id}`,
    );
  });

  it("falls back to a link when the deck could not be loaded", () => {
    expect(decklistEmbed.exportAs("reddit", { id }, null, context)).toBe(
      `[Decklist](https://example.test/decks/${id})`,
    );
  });
});
