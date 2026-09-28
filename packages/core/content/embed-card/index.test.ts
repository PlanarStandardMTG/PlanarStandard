import { describe, expect, it } from "vitest";

import { cardEmbed, parseCardEmbed } from "./index";

const context = { origin: "https://planarstandard.com" };
const elves = {
  name: "Llanowar Elves",
  scryfallUrl: "https://scryfall.com/card/fdn/227",
  image: "https://cards.scryfall.io/normal/front/elves.jpg",
};

describe("parseCardEmbed", () => {
  it("needs a name", () => {
    expect(parseCardEmbed({})).toStrictEqual({ ok: false, problem: "needs a card name" });
    expect(parseCardEmbed({ name: "  " }).ok).toBe(false);
  });

  it("trims the name", () => {
    expect(parseCardEmbed({ name: " Opt " })).toStrictEqual({ ok: true, value: { name: "Opt" } });
  });
});

describe("cardEmbed exports", () => {
  it("links the resolved card's name to its Scryfall page", () => {
    const raw = { name: "llanowar elves" };
    expect(cardEmbed.exportAs("reddit", raw, elves, context)).toBe(
      "[Llanowar Elves](https://scryfall.com/card/fdn/227)",
    );
    expect(cardEmbed.exportAs("discord", raw, elves, context)).toBe(
      "[Llanowar Elves](<https://scryfall.com/card/fdn/227>)",
    );
  });

  it("falls back to an exact-name search when nothing resolved", () => {
    expect(cardEmbed.exportAs("reddit", { name: "Opt" }, null, context)).toBe(
      "[Opt](https://scryfall.com/search?q=!%22Opt%22)",
    );
  });

  it("may be placed in any post", () => {
    expect(cardEmbed.kinds).toStrictEqual(["official", "community"]);
  });
});
