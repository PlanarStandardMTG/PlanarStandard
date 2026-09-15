// E12.8 — ADR 006, enforced across every adapter at once.
//
// Elo consumes `matches`. A standings-only import is recorded for metagame
// purposes and leaves the tournament unrated. Pairings inferred from placements
// look plausible and silently corrupt every rating downstream, so the rule is
// tested here rather than once per adapter, where a new source would miss it.

import { readFileSync } from "node:fs";
import type { ColumnMapping, RawInput } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { defaultRegistry, genericCsv } from "./index";

const standingsText = readFileSync(
  new URL("../../fixtures/generic-csv/standings-only.tsv", import.meta.url),
  "utf8",
);

const STANDINGS_MAP: ColumnMapping = {
  handle: "Player",
  placement: "Rank",
  matchWins: "Match W",
  matchLosses: "Match L",
  matchDraws: "Match D",
  gameWins: "Game W",
  gameLosses: "Game L",
};

const upload = (text: string, columnMapping?: ColumnMapping): RawInput => ({
  fileName: "standings.tsv",
  bytes: new TextEncoder().encode(text),
  text,
  ...(columnMapping === undefined ? {} : { columnMapping }),
});

describe("adapters — capability gating", () => {
  it("does not infer a single pairing from a full standings sheet", () => {
    const parsed = genericCsv.parse(upload(standingsText, STANDINGS_MAP));

    // Four players with complete records, every placement known, and still no
    // pairings: who beat whom is not recoverable from where people finished.
    expect(parsed.standings).toHaveLength(4);
    expect(parsed.capabilities).toEqual(["standings"]);
    expect(parsed.matches).toBeUndefined();
  });

  it("omits an empty payload rather than shipping one", () => {
    const parsed = genericCsv.parse(upload(standingsText, STANDINGS_MAP));

    // `matches: []` would read as "this event had no pairings", which rates as
    // a complete, unremarkable event instead of an unrated one.
    expect("matches" in parsed).toBe(false);
    expect(parsed.capabilities).not.toContain("matches");
  });

  it("claims `matches` only when it produced some", () => {
    for (const entry of defaultRegistry) {
      const parsed = entry.adapter.parse(upload(standingsText, STANDINGS_MAP));
      const claimed = parsed.capabilities.includes("matches");

      expect(claimed).toBe((parsed.matches ?? []).length > 0);
    }
  });

  it("never reports a capability the adapter does not declare", () => {
    for (const entry of defaultRegistry) {
      const parsed = entry.adapter.parse(upload(standingsText, STANDINGS_MAP));
      for (const capability of parsed.capabilities) {
        expect(entry.adapter.capabilities).toContain(capability);
      }
    }
  });

  it("does not turn a decklist source into an event with results", () => {
    const map = defaultRegistry.find((entry) => entry.adapter.id === "archetype-map-html");
    const parsed = map?.adapter.parse(
      upload(
        readFileSync(
          new URL("../../fixtures/archetype-map/season-ii-excerpt.html", import.meta.url),
          "utf8",
        ),
      ),
    );

    // Three decklists, each with a record printed on it, and still no matches:
    // a record says how someone did, never against whom.
    expect(parsed?.decklists).toHaveLength(3);
    expect(parsed?.capabilities).toEqual(["decklists"]);
    expect(parsed?.matches).toBeUndefined();
    expect(parsed?.standings).toBeUndefined();
  });

  it("keeps a bye out of the pairings a rating would consume", () => {
    const parsed = genericCsv.parse(
      upload("P1,P2,Result\nZaunus13,,\n", {
        p1Handle: "P1",
        p2Handle: "P2",
        result: "Result",
      }),
    );

    // The row is real and stages; `bye` is what tells the replay to skip it.
    expect(parsed.matches?.[0]?.result).toBe("bye");
    expect(parsed.matches?.[0]?.p2Handle).toBeUndefined();
  });
});
