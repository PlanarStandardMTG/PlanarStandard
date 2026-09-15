import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { normalizeFaces, normalizeName } from "./index";

const fixture = (name: string): string =>
  readFileSync(new URL(`../../../../fixtures/decklists/${name}`, import.meta.url), "utf8");

describe("core/decklist/normalize-name", () => {
  it("folds case and strips punctuation", () => {
    expect(normalizeName("Ride's End")).toBe("rides end");
    expect(normalizeName("Ugin, Eye of the Storms")).toBe("ugin eye of the storms");
    expect(normalizeName("Space-Time Anomaly")).toBe("spacetime anomaly");
  });

  it("normalizes a ' / ' split card identically to its ' // ' form", () => {
    // The acceptance criterion, on a real card from the Season II corpus.
    const slash = normalizeName("Sanar, Unfinished Genius / Wild Idea");
    const doubleSlash = normalizeName("Sanar, Unfinished Genius // Wild Idea");
    expect(slash).toBe(doubleSlash);
    expect(slash).toBe("sanar unfinished genius // wild idea");
  });

  it("handles the real split cards from the fixture corpus", () => {
    expect(normalizeName("Marang River Regent / Coil and Catch")).toBe(
      "marang river regent // coil and catch",
    );
    expect(normalizeName("Ashling, Rekindled / Ashling, Rimebound")).toBe(
      "ashling rekindled // ashling rimebound",
    );
  });

  it("folds curly punctuation onto its ASCII lookalike", () => {
    expect(normalizeName("Ride’s End")).toBe(normalizeName("Ride's End"));
    expect(normalizeName("Space–Time Anomaly")).toBe(normalizeName("Space-Time Anomaly"));
    expect(normalizeName("Stock Up")).toBe(normalizeName("Stock Up"));
  });

  it("applies NFKC, so fullwidth text folds onto ASCII", () => {
    expect(normalizeName("Ｓｔｏｃｋ Ｕｐ")).toBe("stock up");
  });

  it("keeps letters outside ASCII rather than deleting them", () => {
    expect(normalizeName("Márton, Stalwart Hero")).toBe("márton stalwart hero");
  });

  it("collapses runs of whitespace", () => {
    expect(normalizeName("  Stock   Up  ")).toBe("stock up");
  });

  it("is idempotent", () => {
    for (const name of [
      "Ride's End",
      "Marang River Regent / Coil and Catch",
      "Ugin, Eye of the Storms",
      "  Stock   Up  ",
      "Márton, Stalwart Hero",
    ]) {
      const once = normalizeName(name);
      expect(normalizeName(once)).toBe(once);
    }
  });

  it("is idempotent across every card name in the fixture corpus", () => {
    const names = fixture("real-deck-azorius-control.txt")
      .split("\n")
      .filter((line) => /^\d+ /.test(line))
      .map((line) => line.replace(/^\d+ /, "").replace(/ \([A-Za-z0-9]+\).*$/, ""));

    expect(names.length).toBeGreaterThan(20);
    for (const name of names) {
      const once = normalizeName(name);
      expect(normalizeName(once)).toBe(once);
      expect(once).not.toBe("");
    }
  });

  it("splits faces for the index to key individually", () => {
    expect(normalizeFaces("Marang River Regent / Coil and Catch")).toEqual([
      "marang river regent",
      "coil and catch",
    ]);
    expect(normalizeFaces("Stock Up")).toEqual(["stock up"]);
  });

  it("returns nothing for a name with no letters or digits at all", () => {
    expect(normalizeName("   ")).toBe("");
    expect(normalizeName("---")).toBe("");
    expect(normalizeFaces("")).toEqual([]);
  });
});
