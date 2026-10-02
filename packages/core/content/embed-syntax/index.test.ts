import { describe, expect, it } from "vitest";

import { findEmbeds, formatEmbed, parseEmbedLine, replaceEmbeds } from "./index";

describe("parseEmbedLine", () => {
  it("reads a name and its attributes", () => {
    expect(parseEmbedLine(':::decklist{id="abc" title="Rakdos Midrange"}')).toStrictEqual({
      name: "decklist",
      attributes: { id: "abc", title: "Rakdos Midrange" },
      source: ':::decklist{id="abc" title="Rakdos Midrange"}',
      inline: false,
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

describe("inline calls", () => {
  const sentence =
    'Cast :::card{name="Opt" inline="true"} before :::card{name="Shock" inline="true"}.';

  it("finds each call marked inline within a sentence", () => {
    expect(findEmbeds(sentence)).toStrictEqual([
      {
        name: "card",
        attributes: { name: "Opt", inline: "true" },
        source: ':::card{name="Opt" inline="true"}',
        inline: true,
      },
      {
        name: "card",
        attributes: { name: "Shock", inline: "true" },
        source: ':::card{name="Shock" inline="true"}',
        inline: true,
      },
    ]);
  });

  it("rewrites them in place", () => {
    expect(replaceEmbeds(sentence, (call) => `[${call.attributes["name"]}]`)).toBe(
      "Cast [Opt] before [Shock].",
    );
  });

  it("treats an inline call alone on its line as inline", () => {
    expect(findEmbeds(':::card{name="Opt" inline="true"}').map((c) => c.inline)).toStrictEqual([
      true,
    ]);
  });

  it.each([
    'Cast :::card{name="Opt"} first.',
    'Cast :::card{name="Opt" inline="yes"} first.',
    'Write `:::card{name="Opt" inline="true"}` to place one.',
    'Write ``a ` and :::card{name="Opt" inline="true"}`` to place one.',
  ])("leaves %s as text", (line) => {
    expect(findEmbeds(line)).toHaveLength(0);
  });

  it("skips fenced code", () => {
    expect(findEmbeds('```\nCast :::card{name="Opt" inline="true"}\n```')).toHaveLength(0);
  });
});

describe("formatEmbed", () => {
  it("round-trips through the parser", () => {
    const line = formatEmbed("decklist", { id: "a", title: 'The "best" deck' });
    expect(parseEmbedLine(line)?.attributes).toStrictEqual({ id: "a", title: "The best deck" });
  });
});
