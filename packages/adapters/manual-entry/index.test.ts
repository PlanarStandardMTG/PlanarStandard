import type { RawInput } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { manualEntry } from "./index";

const upload = (payload: unknown, fileName = "manual-entry.json"): RawInput => {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return { fileName, bytes: new TextEncoder().encode(text), text };
};

const EVENT = {
  adapter: "manual-entry",
  name: "Planar Standard Weekly #42",
  date: "2026-09-12",
  platform: "Spelltable",
  structure: "swiss",
  rounds: 4,
  matches: [
    { round: 1, table: 1, p1: "Zaunus13", p2: "divnyi", result: "2-1" },
    { round: 1, table: 2, p1: "SoloQueue" },
    { round: 2, p1: "divnyi", p2: "SoloQueue", result: "draw" },
  ],
};

describe("adapters/manual-entry", () => {
  it("turns a filled-in form into an event", () => {
    const parsed = manualEntry.parse(upload(EVENT));

    expect(parsed.issues).toEqual([]);
    expect(parsed.capabilities).toEqual(["matches"]);
    expect(parsed.name).toBe("Planar Standard Weekly #42");
    expect(parsed.date).toBe("2026-09-12");
    expect(parsed.rounds).toBe(4);
    expect(parsed.matches).toHaveLength(3);
  });

  it("counts the distinct handles, counting a bye's one side once", () => {
    expect(manualEntry.parse(upload(EVENT)).playerCount).toBe(3);
  });

  it("records a pairing with no opponent as a bye", () => {
    const bye = manualEntry.parse(upload(EVENT)).matches?.[1];

    expect(bye).toEqual({
      rowIndex: 1,
      raw: { round: 1, table: 2, p1: "SoloQueue" },
      p1Handle: "SoloQueue",
      result: "bye",
      round: 1,
      tableNumber: 2,
    });
  });

  it("keeps the source row, flattened, for staging", () => {
    const parsed = manualEntry.parse(
      upload({
        adapter: "manual-entry",
        matches: [{ p1: "a", p2: "b", result: "win", notes: { by: "judge" } }],
      }),
    );

    expect(parsed.matches?.[0]?.raw).toEqual({
      p1: "a",
      p2: "b",
      result: "win",
    });
  });

  it("stages a pairing whose result is unreadable", () => {
    const parsed = manualEntry.parse(
      upload({
        adapter: "manual-entry",
        matches: [{ p1: "a", p2: "b", result: "?" }],
      }),
    );

    expect(parsed.matches?.[0]?.result).toBeNull();
    expect(parsed.issues[0]).toMatchObject({
      code: "unreadable-result",
      rowIndex: 0,
    });
  });

  it("skips a pairing that names no first player", () => {
    const parsed = manualEntry.parse(
      upload({
        adapter: "manual-entry",
        matches: [
          { p2: "b", result: "win" },
          { p1: "a", p2: "b", result: "win" },
        ],
      }),
    );

    expect(parsed.matches).toHaveLength(1);
    expect(parsed.issues[0]).toMatchObject({
      code: "missing-handle",
      rowIndex: 0,
    });
  });

  it("reports an empty form rather than an event with no pairings", () => {
    const parsed = manualEntry.parse(upload({ adapter: "manual-entry", matches: [] }));

    expect(parsed.capabilities).toEqual([]);
    expect(parsed.matches).toBeUndefined();
    expect(parsed.issues.map((i) => i.code)).toContain("empty-file");
  });

  it("ignores a date that is not an ISO one", () => {
    const parsed = manualEntry.parse(upload({ ...EVENT, date: "12/09/2026" }));
    expect(parsed.date).toBeUndefined();
  });

  describe("detect", () => {
    it("claims only a payload that names this adapter", () => {
      expect(manualEntry.detect(upload(EVENT))).toBe(true);
      expect(manualEntry.detect(upload({ name: "x", matches: [] }))).toBe(false);
      expect(manualEntry.detect(upload({ adapter: "melee-csv", matches: [] }))).toBe(false);
    });

    it("declines anything that is not a JSON object", () => {
      expect(manualEntry.detect(upload("Round,Player\n1,a\n", "results.csv"))).toBe(false);
      expect(manualEntry.detect(upload("[{}]", "list.json"))).toBe(false);
      expect(manualEntry.detect(upload("{ not json", "broken.json"))).toBe(false);
    });

    it("survives a byte-order mark, which JSON.parse alone does not", () => {
      const text = `﻿${JSON.stringify(EVENT)}`;
      expect(
        manualEntry.detect({
          fileName: "e.json",
          bytes: new TextEncoder().encode(text),
        }),
      ).toBe(true);
    });
  });
});
