import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { expandChartShortcodes } from "./index";

const CANONICAL = "https://planarstandard.test/articles/season-ii-recap";
const fixture = (name: string): string =>
  readFileSync(new URL(`../../../../fixtures/reddit/${name}`, import.meta.url), "utf8");

describe("core/reddit/expand-chart-shortcodes", () => {
  it("converts the fixture to its sibling expectation", () => {
    expect(expandChartShortcodes(fixture("expand-chart-shortcodes.in.md"), CANONICAL)).toBe(fixture("expand-chart-shortcodes.out.md"));
  });

  it("is idempotent", () => {
    const once = expandChartShortcodes(fixture("expand-chart-shortcodes.in.md"), CANONICAL);
    expect(expandChartShortcodes(once, CANONICAL)).toBe(once);
  });

  it("leaves text with nothing to convert untouched", () => {
    const plain = "Just a paragraph with no special syntax at all.\n";
    expect(expandChartShortcodes(plain, CANONICAL)).toBe(plain);
  });
});
