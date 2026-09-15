import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { tokenizeLine } from "./index";

const fixture = (name: string): readonly string[] =>
  readFileSync(new URL(`../../../../fixtures/decklists/${name}`, import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

const ok = (line: string) => {
  const result = tokenizeLine(line);
  if (!result.ok) throw new Error(`expected ${JSON.stringify(line)} to tokenize: ${result.message}`);
  return result.token;
};

describe("core/decklist/tokenize-line", () => {
  it("tokenizes the canonical form", () => {
    expect(ok("4 Bolt (FDN) 192 *F*")).toEqual({
      qty: 4,
      name: "Bolt",
      set: "FDN",
      collector: "192",
      foil: true,
    });
  });

  it("omits set and collector rather than emptying them", () => {
    const token = ok("2 Soul-Guide Lantern");
    expect(token).toEqual({ qty: 2, name: "Soul-Guide Lantern", foil: false });
    expect("set" in token).toBe(false);
    expect("collector" in token).toBe(false);
  });

  it("keeps a split-card name whole, slash and all", () => {
    expect(ok("4 Marang River Regent / Coil and Catch (TDM) 51")).toMatchObject({
      qty: 4,
      name: "Marang River Regent / Coil and Catch",
      set: "TDM",
      collector: "51",
    });
    expect(ok("2 Marang River Regent / Coil and Catch")).toMatchObject({
      name: "Marang River Regent / Coil and Catch",
      foil: false,
    });
  });

  it("keeps alphanumeric collector numbers as strings", () => {
    expect(ok("2 Elspeth, Storm Slayer (PTDM) 11p").collector).toBe("11p");
    expect(ok("1 Fumigate (PKLD) 15s *F*").collector).toBe("15s");
    expect(ok("1 Essence Scatter (PLST) M19-54").collector).toBe("M19-54");
    expect(ok("4 Day of Judgment (PZEN) 9★ *F*").collector).toBe("9★");
    expect(ok("1 Giant Growth (WC99) ml233").collector).toBe("ml233");
  });

  it("does not upper-case a set code the exporter left lower", () => {
    // Normalizing belongs to the index lookup, not the tokenizer.
    expect(ok("4 Llanowar Elves (fdn) 227").set).toBe("fdn");
  });

  it("accepts the 4x form as well as 4", () => {
    expect(ok("4x Stock Up (DFT) 67")).toMatchObject({ qty: 4, name: "Stock Up" });
    expect(ok("4X Stock Up")).toMatchObject({ qty: 4, name: "Stock Up" });
  });

  it("survives a BOM and a CRLF line ending", () => {
    expect(ok("﻿1 Authority of the Consuls (FDN) 137")).toMatchObject({
      qty: 1,
      name: "Authority of the Consuls",
    });
    expect(ok("7 Island (EOE) 270\r")).toMatchObject({ qty: 7, name: "Island" });
  });

  it("treats a bare number in parentheses mid-name as part of the name", () => {
    // Only a trailing `(SET) COLLECTOR` pair is a printing.
    expect(ok("1 Cathar Commando (FDN)").name).toBe("Cathar Commando (FDN)");
  });

  it("reports a missing quantity with the offending column", () => {
    const result = tokenizeLine("Lightning Bolt (FDN) 192");
    expect(result).toMatchObject({ ok: false, code: "missing-quantity", column: 1 });
  });

  it("points at the first non-space character when the line is indented", () => {
    const result = tokenizeLine("    Lightning Bolt");
    expect(result).toMatchObject({ ok: false, code: "missing-quantity", column: 5 });
  });

  it("rejects a quantity of zero", () => {
    expect(tokenizeLine("0 Stock Up (DFT) 67")).toMatchObject({
      ok: false,
      code: "invalid-quantity",
    });
  });

  it("rejects a quantity with no card name after it", () => {
    expect(tokenizeLine("4")).toMatchObject({ ok: false });
    expect(tokenizeLine("4 ")).toMatchObject({ ok: false });
  });

  it("rejects an empty line rather than inventing a card", () => {
    expect(tokenizeLine("")).toMatchObject({ ok: false, code: "unrecognized-line" });
    expect(tokenizeLine("   ")).toMatchObject({ ok: false, code: "unrecognized-line" });
  });

  describe("the whole fixture corpus", () => {
    const CARD_FIXTURES = [
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
    ] as const;

    it.each(CARD_FIXTURES)("every card line in %s tokenizes", (file) => {
      const lines = fixture(file).filter((line) => line.trim() !== "SIDEBOARD:");
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        const result = tokenizeLine(line);
        if (!result.ok) {
          throw new Error(`${file}: ${JSON.stringify(line)} -> ${result.code} at ${result.column}`);
        }
        expect(result.token.qty).toBeGreaterThan(0);
        expect(result.token.name.length).toBeGreaterThan(0);
      }
    });

    it("finds the foil marker on every line of foil-marker.txt", () => {
      for (const line of fixture("foil-marker.txt")) {
        expect(ok(line).foil).toBe(true);
      }
    });

    it("finds no printing on any line of missing-set-code.txt", () => {
      for (const line of fixture("missing-set-code.txt")) {
        const token = ok(line);
        expect("set" in token).toBe(false);
        expect("collector" in token).toBe(false);
      }
    });
  });
});
