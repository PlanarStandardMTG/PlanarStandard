import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { absolutizeLinks } from "./index";

const CANONICAL = "https://planarstandard.test/articles/season-ii-recap";
const fixture = (name: string): string =>
  readFileSync(new URL(`../../../../fixtures/reddit/${name}`, import.meta.url), "utf8");

describe("core/reddit/absolutize-links", () => {
  it("converts the fixture to its sibling expectation", () => {
    expect(absolutizeLinks(fixture("absolutize-links.in.md"), CANONICAL)).toBe(
      fixture("absolutize-links.out.md"),
    );
  });

  it("is idempotent", () => {
    const once = absolutizeLinks(fixture("absolutize-links.in.md"), CANONICAL);
    expect(absolutizeLinks(once, CANONICAL)).toBe(once);
  });

  it("leaves text with nothing to convert untouched", () => {
    const plain = "Just a paragraph with no special syntax at all.\n";
    expect(absolutizeLinks(plain, CANONICAL)).toBe(plain);
  });
});
