import type { IsoDate, LedgerMatch, PlayerId, RatingConfig } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { replay } from "./index";

const CONFIG: RatingConfig = {
  initialRating: 1500,
  kProvisional: 40,
  kStandard: 24,
  kElite: 16,
  provisionalMatches: 15,
  eliteThreshold: 2100,
  minMatchesForLeaderboard: 10,
  inactiveAfterDays: 120,
  countByes: false,
  countEliminationRounds: true,
};

const p = (id: string): PlayerId => id as PlayerId;

// Handles taken from the real Season II ledger.
const SERLUPIDUS = p("serlupidus");
const SUNSETT = p("sunsett");
const MOSS_KNIGHT = p("moss-knight");

function match(over: Partial<LedgerMatch> & Pick<LedgerMatch, "matchId">): LedgerMatch {
  return {
    tournamentId: "open-2025-11-02",
    eventDate: "2025-11-02" as IsoDate,
    tournamentWeight: 1,
    round: 1,
    p1PlayerId: SERLUPIDUS,
    p2PlayerId: SUNSETT,
    p1Games: 2,
    p2Games: 1,
    gameDraws: 0,
    result: "p1_win",
    isElimination: false,
    ...over,
  };
}

const ratingOf = (result: ReturnType<typeof replay>, id: PlayerId): number =>
  result.ratings.find((r) => r.playerId === id)?.rating ?? Number.NaN;

describe("core/elo/replay", () => {
  it("produces the expected rating table from a fixture of matches", () => {
    const result = replay(
      [
        match({ matchId: "m1", round: 1 }),
        match({ matchId: "m2", round: 2, p1PlayerId: SUNSETT, p2PlayerId: MOSS_KNIGHT }),
        match({ matchId: "m3", round: 3, p1PlayerId: SERLUPIDUS, p2PlayerId: MOSS_KNIGHT }),
      ],
      CONFIG,
    );

    expect(result.matchesApplied).toBe(3);
    expect(result.events).toHaveLength(6);
    expect(result.anomalies).toEqual([]);

    // Everyone starts at 1500 on provisional K = 40.
    // m1: serlupidus beats sunsett, E = .5     -> 1520.0000 / 1480.0000
    // m2: sunsett beats moss-knight, E = .4712 -> 1501.1500 / 1478.8500
    // m3: serlupidus beats moss-knight, E = .5589 -> 1537.6422 / 1461.2077
    expect(ratingOf(result, SERLUPIDUS)).toBeCloseTo(1537.6422, 4);
    expect(ratingOf(result, SUNSETT)).toBeCloseTo(1501.15, 4);
    expect(ratingOf(result, MOSS_KNIGHT)).toBeCloseTo(1461.2077, 4);
  });

  it("is zero-sum across a single match at equal K", () => {
    const result = replay([match({ matchId: "m1" })], CONFIG);
    const total = result.ratings.reduce((sum, r) => sum + r.rating, 0);
    expect(total).toBeCloseTo(2 * CONFIG.initialRating, 9);
  });

  it("replays identically whatever order the stream arrives in", () => {
    const stream = [
      match({ matchId: "b", round: 2, p1PlayerId: SUNSETT, p2PlayerId: MOSS_KNIGHT }),
      match({ matchId: "a", round: 1 }),
      match({ matchId: "c", round: 3, p1PlayerId: SERLUPIDUS, p2PlayerId: MOSS_KNIGHT }),
    ];
    const forwards = replay(stream, CONFIG);
    const backwards = replay([...stream].reverse(), CONFIG);
    expect(backwards.ratings).toEqual(forwards.ratings);
    expect(backwards.events).toEqual(forwards.events);
  });

  it("breaks a same-date, same-round tie on match id, deterministically", () => {
    const sameRound = [
      match({ matchId: "zzz", round: 1, p1PlayerId: SUNSETT, p2PlayerId: MOSS_KNIGHT }),
      match({ matchId: "aaa", round: 1 }),
    ];
    const once = replay(sameRound, CONFIG);
    const again = replay([...sameRound].reverse(), CONFIG);
    expect(again.events.map((e) => e.matchId)).toEqual(once.events.map((e) => e.matchId));
    expect(once.events[0]?.matchId).toBe("aaa");
  });

  it("emits one rating event per player per match, numbered from one", () => {
    const result = replay(
      [match({ matchId: "m1", round: 1 }), match({ matchId: "m2", round: 2 })],
      CONFIG,
    );
    const mine = result.events.filter((e) => e.playerId === SERLUPIDUS);
    expect(mine.map((e) => e.matchNumber)).toEqual([1, 2]);
    expect(mine[0]?.ratingAfter).toBe(mine[1]?.ratingBefore);
  });

  it("derives the provisional flag, peak rating and counters", () => {
    const wins = Array.from({ length: 16 }, (_, i) =>
      match({ matchId: `w${i}`, round: i + 1 }),
    );
    const result = replay(wins, CONFIG);
    const winner = result.ratings.find((r) => r.playerId === SERLUPIDUS);

    expect(winner?.matchesPlayed).toBe(16);
    expect(winner?.wins).toBe(16);
    expect(winner?.losses).toBe(0);
    expect(winner?.isProvisional).toBe(false);
    expect(winner?.tournamentsPlayed).toBe(1);
    expect(winner?.lastPlayed).toBe("2025-11-02");
    expect(winner?.peakRating).toBe(winner?.rating);
  });

  it("keeps peak rating after a decline", () => {
    const result = replay(
      [
        match({ matchId: "m1", round: 1 }),
        match({ matchId: "m2", round: 2, result: "p2_win", p1Games: 1, p2Games: 2 }),
        match({ matchId: "m3", round: 3, result: "p2_win", p1Games: 0, p2Games: 2 }),
      ],
      CONFIG,
    );
    const faded = result.ratings.find((r) => r.playerId === SERLUPIDUS);
    expect(faded?.peakRating).toBeGreaterThan(faded?.rating ?? 0);
    expect(faded?.peakRating).toBe(1520);
  });

  it("counts a draw for both sides", () => {
    const result = replay(
      [match({ matchId: "m1", result: "draw", p1Games: 1, p2Games: 1, gameDraws: 1 })],
      CONFIG,
    );
    expect(result.ratings.every((r) => r.draws === 1)).toBe(true);
    expect(result.ratings.every((r) => r.wins === 0 && r.losses === 0)).toBe(true);
  });

  it("marks a player inactive once the idle window passes", () => {
    const result = replay([match({ matchId: "m1" })], CONFIG, {
      asOf: "2026-09-14" as IsoDate,
    });
    expect(result.ratings.every((r) => r.isActive)).toBe(false);

    const fresh = replay([match({ matchId: "m1" })], CONFIG, {
      asOf: "2025-11-30" as IsoDate,
    });
    expect(fresh.ratings.every((r) => r.isActive)).toBe(true);
  });

  it("measures activity against the ledger when no asOf is given", () => {
    // Core is pure: with no reference date, the stream's own last day is the present.
    const result = replay([match({ matchId: "m1" })], CONFIG);
    expect(result.ratings.every((r) => r.isActive)).toBe(true);
  });

  it("counts distinct tournaments, not matches", () => {
    const result = replay(
      [
        match({ matchId: "m1", round: 1 }),
        match({ matchId: "m2", round: 2 }),
        match({
          matchId: "m3",
          tournamentId: "open-2025-11-08",
          eventDate: "2025-11-08" as IsoDate,
        }),
      ],
      CONFIG,
    );
    expect(result.ratings.find((r) => r.playerId === SERLUPIDUS)?.tournamentsPlayed).toBe(2);
  });

  describe("anomalies (E8.5) — returned as data, never thrown", () => {
    it("skips a self-play match and reports it", () => {
      const result = replay([match({ matchId: "m1", p2PlayerId: SERLUPIDUS })], CONFIG);
      expect(result.matchesApplied).toBe(0);
      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0]).toMatchObject({ kind: "self-play", playerId: SERLUPIDUS });
    });

    it("skips a repeated match id and reports where it first appeared", () => {
      const result = replay(
        [match({ matchId: "m1", round: 1 }), match({ matchId: "m1", round: 2 })],
        CONFIG,
      );
      expect(result.matchesApplied).toBe(1);
      expect(result.anomalies[0]).toMatchObject({ kind: "duplicate-match-id", streamIndex: 1 });
    });

    it("reports a game count that contradicts the result but still applies the match", () => {
      const result = replay(
        [match({ matchId: "m1", result: "p1_win", p1Games: 0, p2Games: 2 })],
        CONFIG,
      );
      expect(result.matchesApplied).toBe(1);
      expect(result.anomalies[0]).toMatchObject({ kind: "impossible-game-count" });
    });

    it("treats unreported game counts as unreported, not impossible", () => {
      const result = replay(
        [match({ matchId: "m1", p1Games: 0, p2Games: 0, gameDraws: 0 })],
        CONFIG,
      );
      expect(result.anomalies).toEqual([]);
    });

    it("reports negative game counts", () => {
      const result = replay([match({ matchId: "m1", p1Games: -1 })], CONFIG);
      expect(result.anomalies[0]).toMatchObject({ kind: "impossible-game-count" });
    });

    it("survives a stream that is entirely broken", () => {
      const result = replay(
        [
          match({ matchId: "m1", p2PlayerId: SERLUPIDUS }),
          match({ matchId: "m1", p2PlayerId: SERLUPIDUS }),
        ],
        CONFIG,
      );
      expect(result.ratings).toEqual([]);
      expect(result.matchesApplied).toBe(0);
      expect(result.anomalies).toHaveLength(2);
    });
  });

  describe("capability gating (ADR 006)", () => {
    it("ignores a bye by default, leaving the rating untouched", () => {
      const result = replay(
        [match({ matchId: "m1", result: "bye", p2PlayerId: null, p1Games: 2, p2Games: 0 })],
        CONFIG,
      );
      expect(result.matchesApplied).toBe(0);
      expect(result.ratings[0]?.rating).toBe(1500);
      expect(result.ratings[0]?.matchesPlayed).toBe(0);
    });

    it("counts a bye toward appearances when configured, but never moves a rating", () => {
      const result = replay(
        [match({ matchId: "m1", result: "bye", p2PlayerId: null, p1Games: 2, p2Games: 0 })],
        { ...CONFIG, countByes: true },
      );
      expect(result.ratings[0]?.rating).toBe(1500);
      expect(result.ratings[0]?.matchesPlayed).toBe(1);
      expect(result.ratings[0]?.wins).toBe(1);
    });

    it("excludes elimination rounds when the config says so", () => {
      const result = replay([match({ matchId: "m1", isElimination: true })], {
        ...CONFIG,
        countEliminationRounds: false,
      });
      expect(result.matchesApplied).toBe(0);
    });
  });

  it("returns an empty table for an empty ledger", () => {
    expect(replay([], CONFIG)).toEqual({
      ratings: [],
      events: [],
      anomalies: [],
      matchesApplied: 0,
    });
  });
});
