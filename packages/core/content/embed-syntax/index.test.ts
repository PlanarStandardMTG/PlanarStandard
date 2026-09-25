import { describe, expect, it } from "vitest";

import { findEmbeds, formatEmbed, parseEmbedLine, replaceEmbeds } from "./index";

describe("parseEmbedLine", () => {
  it("reads a name and its attributes", () => {
    expect(parseEmbedLine(':::decklist{id="abc" title="Rakdos Midrange"}')).toStrictEqual({
      name: "decklist",
      attributes: { id: "abc", title: "Rakdos Midrange" },
      source: ':::decklist{id="abc" title="Rakdos Midrange"}',
    });
  });

  it("accepts an empty attribute list and surrounding spaces", () => {
    expect(parseEmbedLine("  :::divider{}  ")?.name).toBe("divider");
  });

  it.each([
    'Some prose :::decklist{id="a"}',
    ':::Decklist{id="a"}',
    ":::decklist",
    '::decklist{id="a"}',
  ])("is not fooled by %s", (line) => {
    expect(parseEmbedLine(line)).toBeNull();
  });
});

describe("findEmbeds", () => {
  it("finds each call in order and skips fenced code", () => {
    const markdown = [
      ':::image{src="a.png"}',
      "",
      "```",
      ':::decklist{id="shown-not-run"}',
      "```",
      ':::decklist{id="b"}',
    ].join("\n");

    expect(findEmbeds(markdown).map((call) => call.name)).toStrictEqual(["image", "decklist"]);
  });

  it("does not close a backtick fence on a tilde one", () => {
    const markdown = ["```", "~~~", ':::decklist{id="x"}', "```"].join("\n");
    expect(findEmbeds(markdown)).toHaveLength(0);
  });
});

describe("replaceEmbeds", () => {
  it("rewrites calls and leaves everything else byte for byte", () => {
    const markdown = 'Before\n:::decklist{id="a"}\nAfter';
    expect(replaceEmbeds(markdown, (call) => `[deck ${call.attributes["id"]}]`)).toBe(
      "Before\n[deck a]\nAfter",
    );
    expect(replaceEmbeds(markdown, () => null)).toBe(markdown);
  });
});

describe("formatEmbed", () => {
  it("round-trips through the parser", () => {
    const line = formatEmbed("decklist", { id: "a", title: 'The "best" deck' });
    expect(parseEmbedLine(line)?.attributes).toStrictEqual({ id: "a", title: "The best deck" });
  });
});
