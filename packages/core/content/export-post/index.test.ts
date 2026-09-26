import { describe, expect, it } from "vitest";

import { EMBED_REGISTRY } from "../embed-catalogue/index";
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

describe("exportPost for Reddit, with the live components", () => {
  const deck = "3f2a0000-0000-4000-8000-000000000001";
  const tournament = `:::tournament{slug="monthly-october" show="winner" deck="${deck}" player="ann"}`;
  const image = ':::image{src="https://cdn.example.test/a.png" alt="The final"}';
  const data = new Map<string, unknown>([
    [
      tournament,
      {
        name: "Monthly October",
        date: "2026-10-04",
        playerCount: 8,
        url: null,
        finishers: [
          { placement: 1, playerSlug: "ann", name: "Ann", record: { wins: 3, losses: 0 } },
        ],
        deck: {
          name: "Mono-Red",
          cards: [
            { quantity: 20, name: "Mountain", board: "main" },
            { quantity: 2, name: "Abrade", board: "side" },
          ],
        },
      },
    ],
  ]);

  it("separates the event and its deck, and the list survives the pipeline line for line", () => {
    const out = exportPost(
      {
        markdown: `${tournament}

${image}`,
        canonicalUrl,
        registry: EMBED_REGISTRY,
        data,
      },
      "reddit",
    );
    expect(out).toContain(
      "**Monthly October** · 4 October 2026 · 8 players\n\n- **1st** Ann (3-0)",
    );
    expect(out).toContain(
      `**Ann's deck (1st):** [Mono-Red](https://example.test/decks/${deck}) · 20 cards, 2 sideboard\n\n` +
        "    20 Mountain\n\n    Sideboard\n    2 Abrade",
    );
    expect(out).toContain("[Image: The final](https://cdn.example.test/a.png)");
    expect(out).not.toContain(":::");
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
