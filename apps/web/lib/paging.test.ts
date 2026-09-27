import { describe, expect, it } from "vitest";

import { pageOf } from "./paging";

const items = Array.from({ length: 25 }, (_, i) => i + 1);

describe("lib/paging", () => {
  it("starts at the first page", () => {
    expect(pageOf(items, undefined, 10)).toEqual({
      items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      page: 1,
      pages: 3,
    });
  });

  it("returns a later page's slice, a short last page included", () => {
    expect(pageOf(items, "3", 10).items).toEqual([21, 22, 23, 24, 25]);
  });

  it("clamps a page out of range, and ignores one that is not a number", () => {
    expect(pageOf(items, "9", 10).page).toBe(3);
    expect(pageOf(items, "0", 10).page).toBe(1);
    expect(pageOf(items, ["2", "3"], 10).page).toBe(1);
    expect(pageOf(items, "abc", 10).page).toBe(1);
  });

  it("is one empty page for an empty list", () => {
    expect(pageOf([], "2", 10)).toEqual({ items: [], page: 1, pages: 1 });
  });
});
