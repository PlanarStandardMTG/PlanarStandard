import type { FormatVersionDetail, OracleId } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { publishedInfoPages } from "@/lib/info-pages/pages";

import { llmsIndex } from "./index-text";
import { pageMarkdown } from "./page-markdown";

const BOLT = "bolt-id" as OracleId;

const format = {
  version: { name: "2026 pool" },
  legalSets: ["FDN", "DFT"],
  coreSets: ["FDN"],
  cardRules: [{ ruling: "banned", oracleId: BOLT }],
  constraints: null,
} as unknown as FormatVersionDetail;

const context = { origin: "https://ps.test", format, cardName: () => "Lightning Bolt" };

describe("pageMarkdown", () => {
  it("writes the data components out and makes links absolute", () => {
    const text = pageMarkdown(
      "{/* generated:start x */}\n\n<LegalSets />\n\n<Banlist />\n\nSee [the rules](/rules).",
      context,
    );
    expect(text).toBe(
      "Legal sets (2026 pool): FDN (core), DFT.\n\n- Lightning Bolt: banned\n\nSee [the rules](https://ps.test/rules).",
    );
  });

  it("says so when there is no current format", () => {
    expect(pageMarkdown("<LegalSets />\n<Banlist />", { ...context, format: null })).toBe(
      "The pool is announced in the Discord.\nNo banlist is published yet.",
    );
  });
});

describe("llmsIndex", () => {
  const text = llmsIndex(publishedInfoPages(), format, "https://ps.test");

  it("files the rules and how to take part under their own headings", () => {
    const rules = text.slice(text.indexOf("## Rules"), text.indexOf("## Get involved"));
    expect(rules).toContain("(https://ps.test/rules)");
    const involved = text.slice(text.indexOf("## Get involved"), text.indexOf("## Results"));
    expect(involved).toContain("(https://ps.test/getting-started)");
  });

  it("lists every published info page exactly once", () => {
    for (const page of publishedInfoPages()) {
      expect(text.split(`(https://ps.test${page.href})`)).toHaveLength(2);
    }
  });
});
