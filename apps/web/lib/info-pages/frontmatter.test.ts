import { describe, expect, it } from "vitest";

import { FrontmatterError, parseFrontmatter } from "./frontmatter";

const VALID = `---
title: Rules & legality
navLabel: Rules
navOrder: 20
description: The legal pool.
published: true
---

Body text.
`;

describe("parseFrontmatter", () => {
  it("reads the six known keys", () => {
    const { frontmatter, body } = parseFrontmatter(VALID);
    expect(frontmatter).toEqual({
      title: "Rules & legality",
      navLabel: "Rules",
      navOrder: 20,
      description: "The legal pool.",
      published: true,
    });
    expect(body.trim()).toBe("Body text.");
  });

  it("omits `components` rather than setting it undefined", () => {
    expect("components" in parseFrontmatter(VALID).frontmatter).toBe(false);
  });

  it("reads an inline component list", () => {
    const source = VALID.replace("published: true", "published: true\ncomponents: [LegalSets, Banlist]");
    expect(parseFrontmatter(source).frontmatter.components).toEqual(["LegalSets", "Banlist"]);
  });

  it("refuses a component outside the whitelist", () => {
    const source = VALID.replace("published: true", "published: true\ncomponents: [ServiceRoleKey]");
    expect(() => parseFrontmatter(source)).toThrow(/not an allowed component/);
  });

  it("refuses an unknown key rather than dropping it", () => {
    // The failure mode this exists for: `navorder` silently losing a nav entry.
    const source = VALID.replace("navOrder: 20", "navOrder: 20\nnavorder: 20");
    expect(() => parseFrontmatter(source)).toThrow(FrontmatterError);
  });

  it.each([
    ["missing key", VALID.replace("description: The legal pool.\n", "")],
    ["non-numeric navOrder", VALID.replace("navOrder: 20", "navOrder: second")],
    ["non-boolean published", VALID.replace("published: true", "published: yes")],
    ["empty title", VALID.replace("title: Rules & legality", "title:")],
    ["no frontmatter at all", "# Just a heading\n"],
    ["unterminated frontmatter", "---\ntitle: x\n"],
  ])("rejects %s", (_name, source) => {
    expect(() => parseFrontmatter(source)).toThrow(FrontmatterError);
  });
});
