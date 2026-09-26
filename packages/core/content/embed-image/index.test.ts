import { describe, expect, it } from "vitest";

import { imageEmbed } from "./index";

const context = { origin: "https://example.test" };
const raw = { src: "https://cdn.example.test/a.png", alt: "The top 8", caption: "Round 5" };

describe("core/content/embed-image", () => {
  it("accepts a web address with alt text", () => {
    expect(imageEmbed.check(raw)).toBeNull();
    expect(imageEmbed.check({ ...raw, caption: "" })).toBeNull();
  });

  it("refuses a missing src, a non-web src, and missing alt text", () => {
    expect(imageEmbed.check({ alt: "x" })).toBe("needs a src");
    expect(imageEmbed.check({ src: "javascript:alert(1)", alt: "x" })).toBe(
      "src must be a web address",
    );
    expect(imageEmbed.check({ src: raw.src })).toMatch(/alt text/);
  });

  it("is a link named by its alt text on Reddit, with the caption under it", () => {
    expect(imageEmbed.exportAs("reddit", raw, null, context)).toBe(
      "[Image: The top 8](https://cdn.example.test/a.png)\n\n*Round 5*",
    );
  });

  it("is the bare address on Discord, which unfurls it", () => {
    expect(imageEmbed.exportAs("discord", { ...raw, caption: "" }, null, context)).toBe(
      "https://cdn.example.test/a.png",
    );
  });
});
