import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { imagesToLinks } from "./index";

const fixture = (name: string): string =>
  readFileSync(new URL(`../../../../fixtures/reddit/${name}`, import.meta.url), "utf8");

describe("core/reddit/images-to-links", () => {
  it("converts the fixture to its sibling expectation", () => {
    expect(imagesToLinks(fixture("images-to-links.in.md"))).toBe(fixture("images-to-links.out.md"));
  });

  it("is idempotent", () => {
    const once = imagesToLinks(fixture("images-to-links.in.md"));
    expect(imagesToLinks(once)).toBe(once);
  });

  it("leaves text with nothing to convert untouched", () => {
    const plain = "Just a paragraph with no special syntax at all.\n";
    expect(imagesToLinks(plain)).toBe(plain);
  });
});
