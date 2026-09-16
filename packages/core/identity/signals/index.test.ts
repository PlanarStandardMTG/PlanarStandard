import type { DeckVector, IdentityId, IsoDate, OracleId } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { normalizeHandle } from "../normalize-handle/index";
import { containment } from "./containment/index";
import { deckFingerprint } from "./deck-fingerprint/index";
import { parenthetical } from "./parenthetical/index";
import { temporal } from "./temporal/index";
import { trigram, trigramSimilarity } from "./trigram/index";
import type { HandleObservation } from "./types";

const card = (n: number): OracleId => `card-${n}` as OracleId;
const vec = (ids: readonly number[], qty = 4): DeckVector =>
  new Map(ids.map((id) => [card(id), qty]));

function observation(raw: string, over: Partial<HandleObservation> = {}): HandleObservation {
  return {
    identityId: raw as IdentityId,
    handle: { platform: "challonge", raw, normalized: normalizeHandle(raw) },
    deckVectors: [],
    eventDates: [],
    tournamentIds: [],
    ...over,
  };
}

describe("core/identity/signals/parenthetical", () => {
  it("pairs a handle with the alias written beside it", () => {
    // Real, from the Season II decklist filenames.
    const signal = parenthetical({
      a: observation("Zaunus13", { alias: "LikoRS" }),
      b: observation("LikoRS"),
    });
    expect(signal).toMatchObject({ kind: "parenthetical", confidence: 0.95 });
    expect(signal?.evidence).toMatchObject({ alias: "LikoRS", matched: "LikoRS" });
  });

  it("works whichever side carried the alias", () => {
    expect(
      parenthetical({ a: observation("c0d33"), b: observation("C0d3", { alias: "c0d33" }) }),
    ).toMatchObject({ kind: "parenthetical" });
  });

  it("matches on the normalized form, not the raw text", () => {
    expect(
      parenthetical({ a: observation("divnyi", { alias: "Mika" }), b: observation("M I K A") }),
    ).not.toBeNull();
  });

  it("stays silent when the alias names someone else", () => {
    expect(
      parenthetical({ a: observation("Zaunus13", { alias: "LikoRS" }), b: observation("Sunsett") }),
    ).toBeNull();
  });

  it("stays silent when there is no alias at all", () => {
    expect(parenthetical({ a: observation("Sunsett"), b: observation("serlupidus") })).toBeNull();
  });
});

describe("core/identity/signals/containment", () => {
  it("fires when one handle nests inside the other", () => {
    // Both of these are real handles in the Season II ledger.
    const signal = containment({
      a: observation("Basscannon"),
      b: observation("BasscannonTtonka"),
    });
    expect(signal).toMatchObject({ kind: "containment", confidence: 0.55 });
  });

  it("refuses a handle too short to mean anything", () => {
    expect(containment({ a: observation("al"), b: observation("Alvarado") })).toBeNull();
    expect(containment({ a: observation("MBI"), b: observation("MBInvincible") })).toBeNull();
  });

  it("stays silent on identical handles, which are not a merge", () => {
    expect(containment({ a: observation("Sunsett"), b: observation("sunsett") })).toBeNull();
  });

  it("stays silent when neither contains the other", () => {
    expect(containment({ a: observation("Sunsett"), b: observation("serlupidus") })).toBeNull();
  });
});

describe("core/identity/signals/trigram", () => {
  it("fires on two spellings of one handle", () => {
    const signal = trigram({ a: observation("Dreamsalong"), b: observation("DreamsAlongg") });
    expect(signal).toMatchObject({ kind: "trigram", confidence: 0.6 });
  });

  it("puts the measured similarity in the evidence, not in the confidence", () => {
    const close = trigram({ a: observation("Basscannon"), b: observation("Basscannnon") });
    expect(close?.confidence).toBe(0.6);
    expect((close?.evidence as { similarity: number }).similarity).toBeGreaterThan(0.5);
  });

  it("stays silent on unrelated handles", () => {
    expect(trigram({ a: observation("Sunsett"), b: observation("serlupidus") })).toBeNull();
    expect(trigram({ a: observation("PoppaCapp"), b: observation("IcySmooth") })).toBeNull();
  });

  it("stays silent on handles that normalize identically", () => {
    // Those are one identity already; there is nothing to suggest.
    expect(trigram({ a: observation("DreamsAlong"), b: observation("Dreamsalong") })).toBeNull();
  });

  it("scores similarity between 0 and 1, symmetrically", () => {
    expect(trigramSimilarity("sunsett", "sunsett")).toBe(1);
    expect(trigramSimilarity("abc", "xyz")).toBe(0);
    expect(trigramSimilarity("basscannon", "basscannonttonka")).toBe(
      trigramSimilarity("basscannonttonka", "basscannon"),
    );
  });
});

describe("core/identity/signals/deck-fingerprint", () => {
  const list = vec([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  it("fires when the same list shows up under two handles", () => {
    const signal = deckFingerprint({
      a: observation("Basscannon", { deckVectors: [list] }),
      b: observation("BasscannonTtonka", { deckVectors: [list] }),
    });
    expect(signal).toMatchObject({ kind: "deck-fingerprint", confidence: 0.9 });
    expect((signal?.evidence as { similarity: number }).similarity).toBe(1);
  });

  it("takes the best pair when a handle registered several decks", () => {
    const signal = deckFingerprint({
      a: observation("a", { deckVectors: [vec([90, 91, 92]), list] }),
      b: observation("b", { deckVectors: [vec([80, 81]), list] }),
    });
    expect(signal).not.toBeNull();
    expect(signal?.evidence).toMatchObject({ leftDeckIndex: 1, rightDeckIndex: 1 });
  });

  it("stays silent on merely similar decks", () => {
    expect(
      deckFingerprint({
        a: observation("a", { deckVectors: [vec([1, 2, 3, 4, 5])] }),
        b: observation("b", { deckVectors: [vec([1, 2, 3, 9, 10])] }),
      }),
    ).toBeNull();
  });

  it("stays silent when either side registered no deck", () => {
    expect(
      deckFingerprint({ a: observation("a", { deckVectors: [list] }), b: observation("b") }),
    ).toBeNull();
    expect(
      deckFingerprint({
        a: observation("a", { deckVectors: [new Map()] }),
        b: observation("b", { deckVectors: [list] }),
      }),
    ).toBeNull();
  });
});

describe("core/identity/signals/temporal", () => {
  const dates = (...values: readonly string[]): readonly IsoDate[] => values as readonly IsoDate[];

  it("fires when one handle stopped before the other started", () => {
    const signal = temporal({
      a: observation("a", { eventDates: dates("2025-10-19", "2025-11-02") }),
      b: observation("b", { eventDates: dates("2025-12-06", "2026-01-11") }),
    });
    expect(signal).toMatchObject({ kind: "temporal", confidence: 0.3 });
    expect(signal?.evidence).toMatchObject({ lastSeen: "2025-11-02", firstSeen: "2025-12-06" });
  });

  it("fires the same way when the later handle is given first", () => {
    expect(
      temporal({
        a: observation("a", { eventDates: dates("2026-01-11") }),
        b: observation("b", { eventDates: dates("2025-10-19") }),
      }),
    ).toMatchObject({ kind: "temporal" });
  });

  it("stays silent when the two overlap", () => {
    expect(
      temporal({
        a: observation("a", { eventDates: dates("2025-10-19", "2025-12-27") }),
        b: observation("b", { eventDates: dates("2025-11-08") }),
      }),
    ).toBeNull();
  });

  it("stays silent when they played the same day", () => {
    expect(
      temporal({
        a: observation("a", { eventDates: dates("2025-11-02") }),
        b: observation("b", { eventDates: dates("2025-11-02") }),
      }),
    ).toBeNull();
  });

  it("stays silent when either side has no events", () => {
    expect(
      temporal({ a: observation("a", { eventDates: dates("2025-11-02") }), b: observation("b") }),
    ).toBeNull();
  });

  it("does not care what order the dates arrive in", () => {
    const sorted = temporal({
      a: observation("a", { eventDates: dates("2025-10-19", "2025-11-02") }),
      b: observation("b", { eventDates: dates("2025-12-06") }),
    });
    const shuffled = temporal({
      a: observation("a", { eventDates: dates("2025-11-02", "2025-10-19") }),
      b: observation("b", { eventDates: dates("2025-12-06") }),
    });
    expect(shuffled).toEqual(sorted);
  });
});

describe("every signal", () => {
  it("returns the uniform { kind, confidence, evidence } shape", () => {
    const signals = [
      parenthetical({ a: observation("Zaunus13", { alias: "LikoRS" }), b: observation("LikoRS") }),
      containment({ a: observation("Basscannon"), b: observation("BasscannonTtonka") }),
      trigram({ a: observation("Dreamsalong"), b: observation("DreamsAlongg") }),
      temporal({
        a: observation("a", { eventDates: ["2025-10-19"] as readonly IsoDate[] }),
        b: observation("b", { eventDates: ["2025-12-06"] as readonly IsoDate[] }),
      }),
      deckFingerprint({
        a: observation("a", { deckVectors: [vec([1, 2, 3])] }),
        b: observation("b", { deckVectors: [vec([1, 2, 3])] }),
      }),
    ];

    for (const signal of signals) {
      expect(signal).not.toBeNull();
      expect(typeof signal?.kind).toBe("string");
      expect(signal?.confidence).toBeGreaterThan(0);
      expect(signal?.confidence).toBeLessThanOrEqual(1);
      expect(signal?.evidence).toBeDefined();
      // Must survive a round trip through a jsonb column.
      expect(() => JSON.stringify(signal)).not.toThrow();
    }
  });

  it("carries the confidences the plan pins", () => {
    expect(
      parenthetical({ a: observation("x", { alias: "y" }), b: observation("y") })?.confidence,
    ).toBe(0.95);
    expect(
      deckFingerprint({
        a: observation("a", { deckVectors: [vec([1, 2, 3])] }),
        b: observation("b", { deckVectors: [vec([1, 2, 3])] }),
      })?.confidence,
    ).toBe(0.9);
    expect(
      trigram({ a: observation("Dreamsalong"), b: observation("DreamsAlongg") })?.confidence,
    ).toBe(0.6);
    expect(
      containment({ a: observation("Basscannon"), b: observation("BasscannonTtonka") })?.confidence,
    ).toBe(0.55);
    expect(
      temporal({
        a: observation("a", { eventDates: ["2025-10-19"] as readonly IsoDate[] }),
        b: observation("b", { eventDates: ["2025-12-06"] as readonly IsoDate[] }),
      })?.confidence,
    ).toBe(0.3);
  });
});
