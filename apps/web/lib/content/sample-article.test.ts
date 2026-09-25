import { describe, expect, it } from "vitest";

import { sampleArticle } from "./sample-article";

describe("sampleArticle", () => {
  const now = new Date("2026-09-25T10:00:00Z");

  it("gives a URL-safe slug", () => {
    expect(sampleArticle(now, 0).slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("gives a different slug a moment later, so resubmitting does not collide", () => {
    const later = new Date(now.getTime() + 1);
    expect(sampleArticle(now, 0).slug).not.toBe(sampleArticle(later, 0).slug);
  });

  it("stays in range at the top of the pick", () => {
    expect(sampleArticle(now, 0.999999).title).toBeTruthy();
  });

  it("says in the body that it is sample content", () => {
    expect(sampleArticle(now, 0.5).bodyMarkdown).toContain("Sample content");
  });
});
