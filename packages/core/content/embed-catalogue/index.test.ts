import { describe, expect, it } from "vitest";

import { EMBEDS, embedsFor } from "./index";

describe("the embed catalogue", () => {
  it("names each component once", () => {
    const names = EMBEDS.map((embed) => embed.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps images and tournaments to news posts", () => {
    const names = (kind: "official" | "community") => embedsFor(kind).map((embed) => embed.name);
    expect(names("official")).toStrictEqual(["image", "decklist", "tournament", "card"]);
    expect(names("community")).toStrictEqual(["decklist", "card"]);
  });
});
