import type { DeckVector, IdentityId, IsoDate, OracleId, PlayerId } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { coAppearanceExclusions } from "../co-appearance-exclusions/index";
import { normalizeHandle } from "../normalize-handle/index";
import type { SignalScorer } from "../signals/types";
import { DEFAULT_MIN_CONFIDENCE, SIGNALS, scoreCandidates, type Candidate } from "./index";

const card = (n: number): OracleId => `card-${n}` as OracleId;
const vec = (ids: readonly number[]): DeckVector => new Map(ids.map((id) => [card(id), 4]));

function candidate(raw: string, over: Partial<Candidate> = {}): Candidate {
  return {
    identityId: raw as IdentityId,
    playerId: `player-${raw}` as PlayerId,
    handle: { platform: "challonge", raw, normalized: normalizeHandle(raw) },
    deckVectors: [],
    eventDates: [],
    tournamentIds: [],
    ...over,
  };
}

describe("core/identity/score-candidates", () => {
  it("ranks a strong pairing above a weak one", () => {
    const ranked = scoreCandidates([
      candidate("Zaunus13", { alias: "LikoRS" }),
      candidate("LikoRS"),
      candidate("Basscannon"),
      candidate("BasscannonTtonka"),
    ]);

    expect(ranked.length).toBeGreaterThanOrEqual(2);
    expect(ranked[0]?.confidence).toBeGreaterThan(ranked[ranked.length - 1]?.confidence ?? 1);
    expect(ranked[0]?.signals.some((s) => s.kind === "parenthetical")).toBe(true);
  });

  it("combines independent signals to more than either alone", () => {
    const alone = scoreCandidates([candidate("Basscannon"), candidate("BasscannonTtonka")]);
    const together = scoreCandidates([
      candidate("Basscannon", { deckVectors: [vec([1, 2, 3, 4, 5])] }),
      candidate("BasscannonTtonka", { deckVectors: [vec([1, 2, 3, 4, 5])] }),
    ]);

    expect(together[0]?.confidence).toBeGreaterThan(alone[0]?.confidence ?? 1);
    expect(together[0]?.signals.length).toBeGreaterThan(alone[0]?.signals.length ?? 99);
  });

  it("never reaches certainty from signals that are not certain", () => {
    const ranked = scoreCandidates([
      candidate("Basscannon", {
        deckVectors: [vec([1, 2, 3, 4, 5])],
        eventDates: ["2025-10-19"] as readonly IsoDate[],
      }),
      candidate("BasscannonTtonka", {
        deckVectors: [vec([1, 2, 3, 4, 5])],
        eventDates: ["2025-12-06"] as readonly IsoDate[],
      }),
    ]);
    expect(ranked[0]?.confidence).toBeLessThan(1);
    expect(ranked[0]?.confidence).toBeGreaterThan(0.9);
  });

  it("zeroes an excluded candidate however strong the signals are", () => {
    // The acceptance criterion. These two played the same event, so they cannot
    // be one person — whatever the parenthetical and the identical deck say.
    const exclusions = coAppearanceExclusions([
      {
        tournamentId: "nov-02" as never,
        identityIds: ["Zaunus13" as IdentityId, "LikoRS" as IdentityId],
      },
    ]);

    const ranked = scoreCandidates(
      [
        candidate("Zaunus13", { alias: "LikoRS", deckVectors: [vec([1, 2, 3])] }),
        candidate("LikoRS", { deckVectors: [vec([1, 2, 3])] }),
      ],
      exclusions,
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.confidence).toBe(0);
    expect(ranked[0]?.excludedBy).toMatchObject({ reason: "co_appearance" });
    // The signals are still reported, so a reviewer sees why it looked plausible.
    expect(ranked[0]?.signals.length).toBeGreaterThan(0);
  });

  it("carries per-signal evidence for the review queue", () => {
    const ranked = scoreCandidates([candidate("Zaunus13", { alias: "LikoRS" }), candidate("LikoRS")]);
    const signal = ranked[0]?.signals.find((s) => s.kind === "parenthetical");
    expect(signal?.evidence).toMatchObject({ alias: "LikoRS" });
    expect(() => JSON.stringify(ranked[0]?.signals)).not.toThrow();
  });

  it("does not suggest merging two handles already on one player", () => {
    const shared = "player-one" as PlayerId;
    const ranked = scoreCandidates([
      candidate("Basscannon", { playerId: shared }),
      candidate("BasscannonTtonka", { playerId: shared }),
    ]);
    expect(ranked).toEqual([]);
  });

  it("drops candidates below the confidence floor", () => {
    const weak = scoreCandidates([
      candidate("aaaa", { eventDates: ["2025-10-19"] as readonly IsoDate[] }),
      candidate("zzzz", { eventDates: ["2025-12-06"] as readonly IsoDate[] }),
    ]);
    // Temporal alone is 0.3, exactly the floor.
    expect(weak).toHaveLength(1);
    expect(scoreCandidates(
      [
        candidate("aaaa", { eventDates: ["2025-10-19"] as readonly IsoDate[] }),
        candidate("zzzz", { eventDates: ["2025-12-06"] as readonly IsoDate[] }),
      ],
      [],
      { minConfidence: 0.5 },
    )).toEqual([]);
    expect(DEFAULT_MIN_CONFIDENCE).toBe(0.3);
  });

  it("produces the same ranking whatever order the candidates arrive in", () => {
    const people = [
      candidate("Zaunus13", { alias: "LikoRS" }),
      candidate("LikoRS"),
      candidate("Basscannon"),
      candidate("BasscannonTtonka"),
    ];
    expect(scoreCandidates([...people].reverse())).toEqual(scoreCandidates(people));
  });

  it("takes a new signal without any change to this module", () => {
    // The acceptance criterion behind "adding a signal is one file": a scorer
    // the module has never heard of composes straight in.
    const inventedSignal: SignalScorer = ({ a, b }) =>
      a.handle.normalized.length === b.handle.normalized.length
        ? { kind: "same-length", confidence: 0.42, evidence: { length: a.handle.normalized.length } }
        : null;

    const ranked = scoreCandidates([candidate("abcd"), candidate("wxyz")], [], {
      signals: [...SIGNALS, inventedSignal],
    });
    expect(ranked[0]?.signals.some((s) => s.kind === "same-length")).toBe(true);
  });

  it("returns nothing for fewer than two candidates", () => {
    expect(scoreCandidates([])).toEqual([]);
    expect(scoreCandidates([candidate("Sunsett")])).toEqual([]);
  });

  it("ships the five signals the plan names", () => {
    expect(SIGNALS).toHaveLength(5);
  });
});
