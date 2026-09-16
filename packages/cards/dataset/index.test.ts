import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { normalizeName } from "@ps/core";
import { describe, expect, it } from "vitest";

import { loadCardDataset, loadCardIndex } from "./index";

/** A directory holding whatever the caller wants the three files to say. */
function datasetDir(files: Readonly<Record<string, unknown>>): URL {
  const dir = mkdtempSync(join(tmpdir(), "ps-cards-"));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), JSON.stringify(content));
  }
  // The trailing slash matters: `new URL("oracle.json", dir)` resolves against
  // the last path segment, and without it that segment is the directory name.
  return pathToFileURL(`${dir}/`);
}

const meta = (over: Record<string, unknown> = {}) => ({
  bulkUpdatedAt: "2026-09-15T00:00:00Z",
  setCodes: ["FDN"],
  oracleCardCount: 1,
  printingCount: 1,
  printingCountBySet: { FDN: 1 },
  generatedAt: "2026-09-15T01:00:00Z",
  attribution: { source: "Scryfall", sourceUrl: "https://scryfall.com", notice: "…" },
  ...over,
});

const card = {
  oracleId: "11111111-1111-4111-8111-000000000001",
  name: "Llanowar Elves",
  manaCost: "{G}",
  cmc: 1,
  typeLine: "Creature — Elf Druid",
  oracleText: "{T}: Add {G}.",
  colors: ["G"],
  colorIdentity: ["G"],
  layout: "normal",
  setCodes: ["FDN"],
  rarities: ["common"],
};

const printing = {
  oracleId: card.oracleId,
  scryfallId: "22222222-2222-4222-8222-000000000001",
  setCode: "FDN",
  collectorNumber: "180",
  rarity: "common",
  artist: "Anna Steinbauer",
  imageUris: null,
};

describe("loadCardDataset", () => {
  it("reads the committed artifact and agrees with its own meta", () => {
    const dataset = loadCardDataset();

    expect(dataset.oracle.length).toBe(dataset.meta.oracleCardCount);
    expect(dataset.printings.length).toBe(dataset.meta.printingCount);
    expect(dataset.meta.attribution.source).toBe("Scryfall");
    expect(dataset.meta.setCodes.length).toBeGreaterThan(0);
  });

  it("returns the same object rather than parsing twice", () => {
    // 2.4 MB of JSON. Re-parsing per request is the cost that never shows up in
    // one trace and shows up in all of them.
    expect(loadCardDataset()).toBe(loadCardDataset());
  });

  it("keeps two directories apart", () => {
    const mine = datasetDir({
      "oracle.json": [card],
      "printings.json": [printing],
      "meta.json": meta(),
    });

    expect(loadCardDataset(mine).oracle).toHaveLength(1);
    expect(loadCardDataset(mine)).toBe(loadCardDataset(mine));
    expect(loadCardDataset(mine)).not.toBe(loadCardDataset());
  });

  it("refuses a dataset whose files disagree with its meta", () => {
    const truncated = datasetDir({
      "oracle.json": [card],
      "printings.json": [],
      "meta.json": meta({ printingCount: 1 }),
    });

    expect(() => loadCardDataset(truncated)).toThrow(/inconsistent/);
    expect(() => loadCardDataset(truncated)).toThrow(/printings\.json has 0 printings/);
  });

  it("reports both halves at once rather than one per rebuild", () => {
    const wrong = datasetDir({
      "oracle.json": [],
      "printings.json": [],
      "meta.json": meta({ oracleCardCount: 9, printingCount: 9 }),
    });

    expect(() => loadCardDataset(wrong)).toThrow(/oracle\.json .*; printings\.json/);
  });

  it("names the job to run when a file is missing", () => {
    const empty = datasetDir({});
    expect(() => loadCardDataset(empty)).toThrow(/build-card-data/);
  });
});

describe("loadCardIndex", () => {
  it("builds the lookups over the committed artifact", () => {
    const index = loadCardIndex();
    const dataset = loadCardDataset();

    expect(index.byOracleId.size).toBe(dataset.oracle.length);
    expect(index.byNormalizedName.size).toBeGreaterThan(0);
    expect(index.bySet.size).toBeGreaterThan(0);
  });

  it("builds it once", () => {
    // Three maps over 1,826 cards and 2,916 printings. Memoizing the dataset
    // and not this would leave most of the cost in place.
    expect(loadCardIndex()).toBe(loadCardIndex());
  });

  it("keys every card under what `normalize-name` makes of its name", () => {
    const index = loadCardIndex();

    // Through core's own normalizer, not a second spelling of it — a decklist
    // arrives at this map the same way.
    for (const card of loadCardDataset().oracle) {
      expect(index.byNormalizedName.get(normalizeName(card.name)), card.name).toContain(
        card.oracleId,
      );
    }
  });
});
