import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { countBoard, parseDecklist } from "./index";

const fixture = (name: string): string =>
  readFileSync(new URL(`../../../../fixtures/decklists/${name}`, import.meta.url), "utf8");

describe("core/decklist/parse-decklist", () => {
  it("parses a complete real decklist into both boards", () => {
    const deck = parseDecklist(fixture("real-deck-azorius-control.txt"));

    expect(deck.issues).toEqual([]);
    expect(countBoard(deck, "main")).toBe(60);
    expect(countBoard(deck, "side")).toBe(15);
    expect(deck.lines.filter((l) => l.board === "side")).toHaveLength(12);
  });

  it("produces the same deck from CRLF and from a BOM-prefixed copy", () => {
    const plain = parseDecklist(fixture("real-deck-azorius-control.txt"));
    const crlf = parseDecklist(fixture("crlf-line-endings.txt"));
    const bom = parseDecklist(fixture("bom-prefixed.txt"));

    expect(crlf.lines).toEqual(plain.lines);
    expect(bom.lines).toEqual(plain.lines);
    expect(crlf.issues).toEqual([]);
    expect(bom.issues).toEqual([]);
  });

  it("numbers lines from one, against the source document", () => {
    const deck = parseDecklist("4 Stock Up (DFT) 67\n\nSIDEBOARD:\n2 Negate (FDN) 710\n");
    expect(deck.lines[0]?.lineNumber).toBe(1);
    expect(deck.lines[1]?.lineNumber).toBe(4);
  });

  describe("board boundaries", () => {
    it("switches on a SIDEBOARD: header", () => {
      const deck = parseDecklist(fixture("real-deck-azorius-control.txt"));
      const ugin = deck.lines.find((l) => l.name.startsWith("Ugin"));
      const annul = deck.lines.find((l) => l.name === "Annul");
      expect(ugin?.board).toBe("main");
      expect(annul?.board).toBe("side");
    });

    it("switches on the bare word Sideboard", () => {
      const deck = parseDecklist(fixture("sideboard-header-word.txt"));
      expect(countBoard(deck, "main")).toBe(8);
      expect(countBoard(deck, "side")).toBe(3);
    });

    it("switches per line on an SB: prefix", () => {
      const deck = parseDecklist(fixture("sideboard-sb-prefix.txt"));
      expect(countBoard(deck, "main")).toBe(8);
      expect(countBoard(deck, "side")).toBe(3);
      expect(deck.lines.find((l) => l.name === "Negate")?.board).toBe("side");
    });

    it("uses a blank line as the boundary when the file has no header at all", () => {
      const deck = parseDecklist(fixture("sideboard-blank-line-only.txt"));
      expect(countBoard(deck, "main")).toBe(8);
      expect(countBoard(deck, "side")).toBe(3);
    });

    it("does not let a blank line mid-maindeck open a sideboard when a header exists", () => {
      // The acceptance criterion. This file has a blank line between maindeck
      // cards, then a real SIDEBOARD: header further down.
      const deck = parseDecklist(fixture("sideboard-blank-line-midboard.txt"));
      expect(countBoard(deck, "main")).toBe(10);
      expect(countBoard(deck, "side")).toBe(2);
      expect(deck.lines.find((l) => l.name === "Refute")?.board).toBe("main");
    });

    it("ignores repeated blank lines once the sideboard has opened", () => {
      const deck = parseDecklist("4 Stock Up\n\n2 Negate\n\n1 Refute\n");
      expect(countBoard(deck, "main")).toBe(4);
      expect(countBoard(deck, "side")).toBe(3);
    });

    it("ignores leading and trailing blank lines", () => {
      const deck = parseDecklist("\n\n4 Stock Up\n\n");
      expect(countBoard(deck, "main")).toBe(4);
      expect(countBoard(deck, "side")).toBe(0);
    });
  });

  describe("issues", () => {
    it("keeps an unparseable line rather than dropping it", () => {
      const deck = parseDecklist("4 Stock Up (DFT) 67\nLightning Bolt\n2 Negate (FDN) 710\n");
      expect(deck.lines).toHaveLength(2);
      expect(deck.issues).toHaveLength(1);
      expect(deck.issues[0]).toMatchObject({
        code: "missing-quantity",
        raw: "Lightning Bolt",
        lineNumber: 2,
        column: 1,
      });
    });

    it("keeps the raw text verbatim so the submitter sees what broke", () => {
      const deck = parseDecklist("  ???  \n");
      expect(deck.issues[0]?.raw).toBe("  ???  ");
    });

    it("skips comments without recording an issue", () => {
      const deck = parseDecklist("# exported 2025-11-02\n4 Stock Up\n// a note\n");
      expect(deck.issues).toEqual([]);
      expect(deck.lines).toHaveLength(1);
    });

    it("returns an empty deck for empty input rather than throwing", () => {
      expect(parseDecklist("")).toEqual({ lines: [], issues: [] });
      expect(parseDecklist("\n\n\n")).toEqual({ lines: [], issues: [] });
    });
  });

  describe("the whole fixture corpus parses", () => {
    const FILES = [
      "missing-set-code.txt",
      "foil-marker.txt",
      "alphanumeric-collector.txt",
      "split-card.txt",
      "lowercase-set-code.txt",
      "out-of-pool-printing.txt",
      "promo-set.txt",
      "real-deck-azorius-control.txt",
      "crlf-line-endings.txt",
      "bom-prefixed.txt",
      "sideboard-header-word.txt",
      "sideboard-sb-prefix.txt",
      "sideboard-blank-line-only.txt",
      "sideboard-blank-line-midboard.txt",
    ] as const;

    it.each(FILES)("%s parses with no issues", (file) => {
      const deck = parseDecklist(fixture(file));
      expect(deck.issues).toEqual([]);
      expect(deck.lines.length).toBeGreaterThan(0);
    });
  });
});
