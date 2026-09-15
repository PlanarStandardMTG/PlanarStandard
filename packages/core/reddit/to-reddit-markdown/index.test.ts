import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { toRedditMarkdown } from "./index";

const canonicalUrl = "https://planarstandard.test/articles/season-ii-recap";
const fixture = (name: string): string =>
  readFileSync(new URL(`../../../../fixtures/reddit/${name}`, import.meta.url), "utf8");

describe("core/reddit/to-reddit-markdown", () => {
  it("runs the whole pipeline over a real article", () => {
    const markdown = fixture("to-reddit-markdown.in.md");
    expect(toRedditMarkdown({ markdown, canonicalUrl })).toBe(
      fixture("to-reddit-markdown.out.md"),
    );
  });

  it("is idempotent on already-converted output", () => {
    // The acceptance criterion: "Copy for Reddit" is a button a writer presses twice.
    const once = toRedditMarkdown({ markdown: fixture("to-reddit-markdown.in.md"), canonicalUrl });
    const twice = toRedditMarkdown({ markdown: once, canonicalUrl });
    expect(twice).toBe(once);
    expect(toRedditMarkdown({ markdown: twice, canonicalUrl })).toBe(once);
  });

  it("appends exactly one backlink, however many times it runs", () => {
    let text = "A paragraph.\n";
    for (let i = 0; i < 4; i += 1) text = toRedditMarkdown({ markdown: text, canonicalUrl });
    expect(text.match(/Originally published at/g)).toHaveLength(1);
  });

  it("ends with the canonical backlink", () => {
    const out = toRedditMarkdown({ markdown: "Hello.\n", canonicalUrl });
    expect(out).toBe(
      `Hello.\n\n*Originally published at [${canonicalUrl}](${canonicalUrl})*\n`,
    );
  });

  it("expands a shortcode before absolutizing, so the chart link is absolute", () => {
    const out = toRedditMarkdown({
      markdown: ':::chart{id="meta-share"}\n',
      canonicalUrl,
    });
    expect(out).toContain("https://planarstandard.test/charts/meta-share");
    expect(out).not.toContain("](/charts/");
  });

  it("leaves an empty article as just its backlink", () => {
    expect(toRedditMarkdown({ markdown: "", canonicalUrl })).toBe(
      `\n\n*Originally published at [${canonicalUrl}](${canonicalUrl})*\n`,
    );
  });
});
