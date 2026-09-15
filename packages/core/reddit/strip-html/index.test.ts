import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { stripHtml } from "./index";

const fixture = (name: string): string =>
  readFileSync(new URL(`../../../../fixtures/reddit/${name}`, import.meta.url), "utf8");

describe("core/reddit/strip-html", () => {
  it("converts the fixture to its sibling expectation", () => {
    expect(stripHtml(fixture("strip-html.in.md"))).toBe(fixture("strip-html.out.md"));
  });

  it("is idempotent", () => {
    const once = stripHtml(fixture("strip-html.in.md"));
    expect(stripHtml(once)).toBe(once);
  });

  it("leaves text with nothing to convert untouched", () => {
    const plain = "Just a paragraph with no special syntax at all.\n";
    expect(stripHtml(plain)).toBe(plain);
  });
});
