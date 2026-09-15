import { readFileSync } from "node:fs";
import type { ColumnMapping, RawInput } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { genericCsv } from "./index";

const fixture = (name: string): string =>
  readFileSync(new URL(`../../../fixtures/generic-csv/${name}`, import.meta.url), "utf8");

const expected = (name: string): unknown =>
  JSON.parse(
    readFileSync(new URL(`../../../fixtures/generic-csv/${name}`, import.meta.url), "utf8"),
  );

const upload = (fileName: string, text: string, columnMapping?: ColumnMapping): RawInput => ({
  fileName,
  bytes: new TextEncoder().encode(text),
  text,
  ...(columnMapping === undefined ? {} : { columnMapping }),
});

const PAIRING_MAP: ColumnMapping = {
  round: "Round",
  tableNumber: "Table",
  p1Handle: "Player 1",
  p2Handle: "Player 2",
  p1Games: "Wins",
  p2Games: "Losses",
  gameDraws: "Draws",
};

const STANDINGS_MAP: ColumnMapping = {
  handle: "Player",
  placement: "Rank",
  matchWins: "Match W",
  matchLosses: "Match L",
  matchDraws: "Match D",
  gameWins: "Game W",
  gameLosses: "Game L",
  dropped: "Dropped",
};

describe("adapters/generic-csv", () => {
  it("parses a real swiss pairing sheet into its expected event", () => {
    const parsed = genericCsv.parse(
      upload("swiss-pairings.csv", fixture("swiss-pairings.csv"), PAIRING_MAP),
    );
    expect(parsed).toEqual(expected("swiss-pairings.expected.json"));
  });

  it("parses a tab-separated standings sheet into its expected event", () => {
    const parsed = genericCsv.parse(
      upload("standings-only.tsv", fixture("standings-only.tsv"), STANDINGS_MAP),
    );
    expect(parsed).toEqual(expected("standings-only.expected.json"));
  });

  it("never produces matches from standings", () => {
    const parsed = genericCsv.parse(
      upload("standings-only.tsv", fixture("standings-only.tsv"), STANDINGS_MAP),
    );
    expect(parsed.capabilities).toEqual(["standings"]);
    expect(parsed.matches).toBeUndefined();
  });

  describe("the mapping", () => {
    it("asks for one, listing the columns it found, when none was given", () => {
      const parsed = genericCsv.parse(upload("x.csv", "Round,Player 1,Player 2\n1,a,b\n"));

      expect(parsed.capabilities).toEqual([]);
      expect(parsed.issues[0]?.code).toBe("missing-column-mapping");
      expect(parsed.issues[0]?.message).toContain("Player 1");
    });

    it("refuses pairings mapped without an opponent column", () => {
      const parsed = genericCsv.parse(
        upload("x.csv", "Player 1,Result\na,win\n", {
          p1Handle: "Player 1",
          result: "Result",
        }),
      );

      expect(parsed.matches).toBeUndefined();
      expect(parsed.issues.map((i) => i.code)).toContain("missing-column-mapping");
    });

    it("matches header names loosely, since an operator sees a label not a key", () => {
      const parsed = genericCsv.parse(
        upload("x.csv", "PLAYER_1,player 2,result\na,b,win\n", {
          p1Handle: "Player 1",
          p2Handle: "player2",
          result: "Result",
        }),
      );

      expect(parsed.matches?.[0]?.p1Handle).toBe("a");
      expect(parsed.matches?.[0]?.result).toBe("p1_win");
    });

    it("reads row one as data when every column is mapped by index", () => {
      const parsed = genericCsv.parse(
        upload("x.csv", "Zaunus13,divnyi,win\n", {
          p1Handle: 0,
          p2Handle: 1,
          result: 2,
        }),
      );

      expect(parsed.matches).toHaveLength(1);
      expect(parsed.matches?.[0]?.p1Handle).toBe("Zaunus13");
      expect(parsed.matches?.[0]?.raw).toEqual({
        col0: "Zaunus13",
        col1: "divnyi",
        col2: "win",
      });
    });

    it("produces both payloads when the mapping names both", () => {
      const parsed = genericCsv.parse(
        upload("x.csv", "P1,P2,Result,Standing\na,b,win,a\n", {
          p1Handle: "P1",
          p2Handle: "P2",
          result: "Result",
          handle: "Standing",
        }),
      );

      expect(parsed.capabilities).toEqual(["matches", "standings"]);
    });
  });

  describe("rows that are not clean", () => {
    it("stages a row whose result is unreadable, with a warning", () => {
      const parsed = genericCsv.parse(
        upload("x.csv", "P1,P2,Result\na,b,see notes\n", {
          p1Handle: "P1",
          p2Handle: "P2",
          result: "Result",
        }),
      );

      expect(parsed.matches?.[0]?.result).toBeNull();
      expect(parsed.issues[0]).toMatchObject({
        code: "unreadable-result",
        severity: "warning",
        rowIndex: 0,
      });
    });

    it("skips a row with no player and says which one", () => {
      const parsed = genericCsv.parse(
        upload("x.csv", "P1,P2,Result\na,b,win\n,c,win\n", {
          p1Handle: "P1",
          p2Handle: "P2",
          result: "Result",
        }),
      );

      expect(parsed.matches).toHaveLength(1);
      expect(parsed.issues[0]).toMatchObject({
        code: "missing-handle",
        rowIndex: 1,
      });
    });

    it("reports an empty file rather than an empty event", () => {
      const parsed = genericCsv.parse(
        upload("x.csv", "P1,P2\n", { p1Handle: "P1", p2Handle: "P2" }),
      );
      expect(parsed.issues.map((i) => i.code)).toContain("empty-file");
    });
  });

  describe("detect", () => {
    it("claims a delimited file", () => {
      expect(genericCsv.detect(upload("results.csv", "a,b\n1,2\n"))).toBe(true);
      expect(genericCsv.detect(upload("results.tsv", "a\tb\n1\t2\n"))).toBe(true);
    });

    it("declines JSON, which is delimited text by any naive test", () => {
      expect(
        genericCsv.detect(upload("entry.json", '{"adapter":"manual-entry","matches":[]}')),
      ).toBe(false);
    });

    it("declines a single-column file and an empty one", () => {
      expect(genericCsv.detect(upload("notes.csv", "just one column\nand another row\n"))).toBe(
        false,
      );
      expect(genericCsv.detect(upload("empty.csv", ""))).toBe(false);
    });

    it("declines an extension it has no reason to read", () => {
      expect(genericCsv.detect(upload("bracket.xlsx", "a,b\n1,2\n"))).toBe(false);
    });
  });
});
