import { describe, expect, it } from "vitest";

import { defineEmbed, expandEmbeds } from "./index";

/** A stand-in component: the registry is exercised before any real one exists. */
const deck = defineEmbed<"deck", { id: string }, { cards: readonly string[] }>({
  name: "deck",
  label: "Deck",
  description: "A test component.",
  attributes: [{ name: "id", required: true, description: "Which deck." }],
  parse: (raw) =>
    raw["id"] === undefined || raw["id"] === ""
      ? { ok: false, problem: "needs an id" }
      : { ok: true, value: { id: raw["id"] } },
  export: {
    reddit: ({ id }, data, { origin }) =>
      [`[Deck](${origin}/decks/${id})`, ...(data?.cards ?? []).map((c) => `    ${c}`)].join("\n"),
    discord: ({ id }, _data, { origin }) => `Deck: ${origin}/decks/${id}`,
  },
});

const context = { origin: "https://example.test" };

describe("defineEmbed", () => {
  it("checks attributes through the definition's own parser", () => {
    expect(deck.check({ id: "a" })).toBeNull();
    expect(deck.check({})).toBe("needs an id");
  });
});

describe("expandEmbeds", () => {
  const markdown = 'Intro\n\n:::deck{id="a"}\n\n:::mystery{x="1"}\n\n:::deck{}';

  it("writes each registered call out for the target", () => {
    expect(expandEmbeds(markdown, "discord", [deck], context)).toBe(
      'Intro\n\nDeck: https://example.test/decks/a\n\n:::mystery{x="1"}\n\n:::deck{}',
    );
  });

  it("hands each call the data loaded for its line", () => {
    const data = new Map([[':::deck{id="a"}', { cards: ["4 Shock"] }]]);
    expect(expandEmbeds(':::deck{id="a"}', "reddit", [deck], context, data)).toBe(
      "[Deck](https://example.test/decks/a)\n    4 Shock",
    );
  });

  it("still exports something useful when nothing was loaded", () => {
    expect(expandEmbeds(':::deck{id="a"}', "reddit", [deck], context)).toBe(
      "[Deck](https://example.test/decks/a)",
    );
  });
});
