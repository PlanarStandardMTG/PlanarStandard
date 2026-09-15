import { describe, expect, it } from "vitest";

import { rawExtension, rawMediaType, rawText } from "./index";

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

const input = (over: Partial<Parameters<typeof rawText>[0]> = {}) => ({
  fileName: "results.csv",
  bytes: bytes("from bytes"),
  ...over,
});

describe("adapters/raw-input", () => {
  it("prefers the decode the caller already had", () => {
    expect(rawText(input({ text: "from text" }))).toBe("from text");
  });

  it("decodes the bytes when there is no text", () => {
    expect(rawText(input())).toBe("from bytes");
  });

  it("decodes UTF-8 beyond ASCII", () => {
    expect(rawText(input({ bytes: bytes("Ｐｌａｙｅｒ｜Deck") }))).toBe("Ｐｌａｙｅｒ｜Deck");
  });

  it("strips a byte-order mark, which JSON.parse will not", () => {
    expect(rawText(input({ text: '﻿{"a":1}' }))).toBe('{"a":1}');
    expect(rawText(input({ bytes: bytes('﻿{"a":1}') }))).toBe('{"a":1}');
  });

  it("lower-cases the extension and reports none for a bare name", () => {
    expect(rawExtension(input({ fileName: "Export.CSV" }))).toBe("csv");
    expect(rawExtension(input({ fileName: "pairings" }))).toBe("");
    expect(rawExtension(input({ fileName: "season.ii.round1.tsv" }))).toBe("tsv");
  });

  it("drops media-type parameters", () => {
    expect(rawMediaType(input({ mediaType: "text/csv; charset=UTF-8" }))).toBe("text/csv");
    expect(rawMediaType(input())).toBe("");
  });
});
