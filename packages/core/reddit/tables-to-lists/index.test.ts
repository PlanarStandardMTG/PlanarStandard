import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { tablesToLists } from "./index";

const fixture = (name: string): string =>
  readFileSync(new URL(`../../../../fixtures/reddit/${name}`, import.meta.url), "utf8");

describe("core/reddit/tables-to-lists", () => {
  it("converts the fixture to its sibling expectation", () => {
    expect(tablesToLists(fixture("tables-to-lists.in.md"))).toBe(fixture("tables-to-lists.out.md"));
  });

  it("is idempotent", () => {
    const once = tablesToLists(fixture("tables-to-lists.in.md"));
    expect(tablesToLists(once)).toBe(once);
  });

  it("leaves text with nothing to convert untouched", () => {
    const plain = "Just a paragraph with no special syntax at all.\n";
    expect(tablesToLists(plain)).toBe(plain);
  });
});
