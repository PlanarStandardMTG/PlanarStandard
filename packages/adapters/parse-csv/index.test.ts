import { describe, expect, it } from "vitest";

import { parseCsv } from "./index";

describe("adapters/parse-csv", () => {
  it("reads a quoted comma, an escaped quote, and CRLF as one table", () => {
    const table = parseCsv('a,b\r\n"Reyes, Ana","said ""hi"""\r\n');

    expect(table.delimiter).toBe(",");
    expect(table.rows).toEqual([
      ["a", "b"],
      ["Reyes, Ana", 'said "hi"'],
    ]);
  });

  it("keeps fields verbatim, spacing included", () => {
    expect(parseCsv("a,b\n 1 , 2 \n").rows[1]).toEqual([" 1 ", " 2 "]);
  });

  it("strips a byte-order mark from the first header", () => {
    expect(parseCsv("﻿Round,Player").rows[0]).toEqual(["Round", "Player"]);
  });

  it("picks the delimiter that makes a consistent table, not the commonest character", () => {
    // A comma inside the event name outnumbers the tabs on that line.
    const tsv = "Event\tPlayer\nWeekly, Season II, week 4\tZaunus13\n";
    expect(parseCsv(tsv).delimiter).toBe("\t");
    expect(parseCsv(tsv).rows[1]).toEqual(["Weekly, Season II, week 4", "Zaunus13"]);
  });

  it("reads semicolon and pipe files", () => {
    expect(parseCsv("a;b\n1;2\n").delimiter).toBe(";");
    expect(parseCsv("a|b\n1|2\n").delimiter).toBe("|");
  });

  it("honours a delimiter the caller already knows", () => {
    expect(parseCsv("a;b\n1;2\n", ",").rows[0]).toEqual(["a;b"]);
  });

  it("treats a quote inside a field as a literal inch mark", () => {
    expect(parseCsv('a,b\nVault 5" Tall,x\n').rows[1]).toEqual(['Vault 5" Tall', "x"]);
  });

  it("drops trailing blank lines but keeps an interior one", () => {
    const table = parseCsv("a,b\n1,2\n\n3,4\n\n\n");
    expect(table.rows).toEqual([["a", "b"], ["1", "2"], [""], ["3", "4"]]);
  });

  it("returns no rows for an empty document", () => {
    expect(parseCsv("").rows).toEqual([]);
    expect(parseCsv("\n\n").rows).toEqual([]);
  });

  it("keeps a newline that sits inside a quoted field", () => {
    expect(parseCsv('a,b\n"line one\nline two",x\n').rows[1]).toEqual(["line one\nline two", "x"]);
  });
});
