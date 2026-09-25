import { describe, expect, it } from "vitest";

import { defineEmbed } from "../embed-registry/index";
import { DISCORD_MESSAGE_LIMIT, exportPost } from "./index";

const canonicalUrl = "https://example.test/community/a-post";

const note = defineEmbed<"note", { text: string }, never>({
  name: "note",
  label: "Note",
  description: "A test component.",
  attributes: [],
  parse: (raw) => ({ ok: true, value: { text: raw["text"] ?? "" } }),
  export: {
    reddit: ({ text }) => `> **Note:** ${text}`,
    discord: ({ text }, _data, { origin }) => `Note: ${text} (${origin})`,
  },
});

const input = {
  markdown: 'Intro with a [link](/meta).\n\n:::note{text="hello"}\n\n#### Small heading',
  canonicalUrl,
  registry: [note],
};

describe("exportPost for Reddit", () => {
  it("expands components before Reddit's pipeline and ends with the backlink", () => {
    const out = exportPost(input, "reddit");
    expect(out).toContain("> **Note:** hello");
    expect(out).toContain("[link](https://example.test/meta)");
    expect(out.trimEnd().endsWith(`[${canonicalUrl}](${canonicalUrl})*`)).toBe(true);
  });
});

describe("exportPost for Discord", () => {
  it("expands components with the site origin, and caps headings at three levels", () => {
    const out = exportPost(input, "discord");
    expect(out).toContain("Note: hello (https://example.test)");
    expect(out).toContain("### Small heading");
    expect(out.endsWith(`Read it on Planar Standard: ${canonicalUrl}`)).toBe(true);
  });

  it("fits a long post into one message, cut at a paragraph", () => {
    const paragraph = "word ".repeat(150).trim();
    const long = Array.from({ length: 10 }, () => paragraph).join("\n\n");
    const out = exportPost({ ...input, markdown: long }, "discord");

    expect(out.length).toBeLessThanOrEqual(DISCORD_MESSAGE_LIMIT);
    expect(out).toContain("word …");
    expect(out.endsWith(canonicalUrl)).toBe(true);
  });

  it("leaves a short post whole", () => {
    expect(exportPost({ ...input, markdown: "Short." }, "discord")).toBe(
      `Short.\n\nRead it on Planar Standard: ${canonicalUrl}`,
    );
  });
});
