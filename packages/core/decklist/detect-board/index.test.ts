import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { detectBoard, hasBoardHeader } from "./index";

const fixture = (name: string): readonly string[] =>
  readFileSync(new URL(`../../../../fixtures/decklists/${name}`, import.meta.url), "utf8").split(
    /\r?\n/,
  );

describe("core/decklist/detect-board", () => {
  it.each([
    ["SIDEBOARD:", "side"],
    ["Sideboard", "side"],
    ["sideboard", "side"],
    ["Side Board", "side"],
    ["SB:", "side"],
    ["// Sideboard", "side"],
    ["Deck", "main"],
    ["Maindeck", "main"],
    ["Main Deck", "main"],
    ["Commander", "command"],
    ["Command Zone", "command"],
  ] as const)("recognizes %s as a %s header", (line, board) => {
    expect(detectBoard(line)).toEqual({ kind: "header", board });
  });

  it("reads a card off an SB: prefix and hands back the rest", () => {
    expect(detectBoard("SB: 2 Negate (FDN) 710")).toEqual({
      kind: "card",
      text: "2 Negate (FDN) 710",
      board: "side",
    });
  });

  it("leaves an ordinary card line alone, with no board opinion", () => {
    const line = detectBoard("4 Stock Up (DFT) 67");
    expect(line).toEqual({ kind: "card", text: "4 Stock Up (DFT) 67" });
    expect("board" in line).toBe(false);
  });

  it("reports blank lines, including whitespace-only ones", () => {
    expect(detectBoard("")).toEqual({ kind: "blank" });
    expect(detectBoard("   ")).toEqual({ kind: "blank" });
    expect(detectBoard("\r")).toEqual({ kind: "blank" });
  });

  it("treats a comment as a comment, not a card", () => {
    expect(detectBoard("# exported 2025-11-02")).toEqual({ kind: "comment" });
    expect(detectBoard("// notes about the list")).toEqual({ kind: "comment" });
  });

  it("strips a BOM and a trailing CR", () => {
    expect(detectBoard("﻿SIDEBOARD:")).toEqual({ kind: "header", board: "side" });
    expect(detectBoard("SIDEBOARD:\r")).toEqual({ kind: "header", board: "side" });
  });

  it("does not mistake a card whose name starts with a board word", () => {
    expect(detectBoard("4 Sideboard Shuffler (FDN) 1").kind).toBe("card");
    expect(detectBoard("1 Commander's Plate (FDN) 2").kind).toBe("card");
  });

  describe("hasBoardHeader", () => {
    it("is true when the file names a board anywhere", () => {
      expect(hasBoardHeader(fixture("real-deck-azorius-control.txt"))).toBe(true);
      expect(hasBoardHeader(fixture("sideboard-header-word.txt"))).toBe(true);
    });

    it("is true for a file that only ever uses an SB: prefix", () => {
      expect(hasBoardHeader(fixture("sideboard-sb-prefix.txt"))).toBe(true);
    });

    it("is false for a file that relies on a blank-line boundary", () => {
      expect(hasBoardHeader(fixture("sideboard-blank-line-only.txt"))).toBe(false);
    });

    it("is what stops a blank line mid-maindeck opening a sideboard", () => {
      // The acceptance criterion: this file has a blank line between maindeck
      // cards AND a SIDEBOARD: header later. The header wins.
      const lines = fixture("sideboard-blank-line-midboard.txt");
      expect(hasBoardHeader(lines)).toBe(true);
      expect(lines.filter((l) => l.trim() === "").length).toBeGreaterThan(1);
    });
  });
});
