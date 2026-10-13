import type { RunPairing } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { runRecords } from "../record/index";
import { gameWinPct, matchWinPct, PERCENTAGE_FLOOR, tiebreakers } from "./index";

type Games = [number, number, number];

let next = 0;
function pairing(p1: string, p2: string | null, games: Games | null = null): RunPairing {
  next += 1;
  return {
    id: `p${next}`,
    roundId: `r${next}`,
    round: next,
    table: 1,
    p1EntrantId: p1,
    p2EntrantId: p2,
    games: games === null ? null : { p1Wins: games[0], p2Wins: games[1], draws: games[2] },
    status: "confirmed",
  };
}

const WIN: Games = [2, 0, 0];
const LOSS: Games = [0, 2, 0];
const DRAW: Games = [1, 1, 1];

/** `id`'s matches against one-off fillers, so its record is exactly `w–l–d` plus anything else. */
function fill(id: string, wins: number, losses: number, draws: number): RunPairing[] {
  return [
    ...Array.from({ length: wins }, (_, i) => pairing(id, `${id}-w${i}`, WIN)),
    ...Array.from({ length: losses }, (_, i) => pairing(id, `${id}-l${i}`, LOSS)),
    ...Array.from({ length: draws }, (_, i) => pairing(id, `${id}-d${i}`, DRAW)),
  ];
}

function recordOf(id: string, pairings: RunPairing[]) {
  const record = runRecords([id], pairings).get(id);
  if (record === undefined) throw new Error(id);
  return record;
}

/**
 * The opponents' records from MTR Appendix C's eight-round example, and whether the player
 * we are measuring beat each of them: the player is 6–2–0, losing to the 7–1–0 and the 6–2–0.
 */
const APPENDIX_C_OPPONENTS: ReadonlyArray<{ record: Games; beatPlayer: boolean }> = [
  { record: [4, 4, 0], beatPlayer: false },
  { record: [7, 1, 0], beatPlayer: true },
  { record: [1, 3, 1], beatPlayer: false },
  { record: [3, 3, 1], beatPlayer: false },
  { record: [6, 2, 0], beatPlayer: true },
  { record: [5, 2, 1], beatPlayer: false },
  { record: [4, 3, 1], beatPlayer: false },
  { record: [6, 1, 1], beatPlayer: false },
];

/** The whole event around the measured player, `player`, built from real pairings. */
function appendixCEvent(withFirstRoundBye: boolean): RunPairing[] {
  const pairings: RunPairing[] = withFirstRoundBye ? [pairing("player", null)] : [];
  APPENDIX_C_OPPONENTS.forEach(({ record: [w, l, d], beatPlayer }, i) => {
    if (withFirstRoundBye && i === 0) return;
    const opponent = `opp${i}`;
    pairings.push(pairing("player", opponent, beatPlayer ? LOSS : WIN));
    pairings.push(...fill(opponent, beatPlayer ? w - 1 : w, beatPlayer ? l : l - 1, d));
  });
  return pairings;
}

describe("core/runs/tiebreakers", () => {
  describe("match-win percentage (MTR Appendix C)", () => {
    it("is match points over 3 × rounds played", () => {
      expect(matchWinPct(recordOf("a", fill("a", 5, 2, 1)))).toBeCloseTo(16 / 24, 10);
    });

    it("measures a player who withdrew over the rounds they played, floored at 0.33", () => {
      expect(matchWinPct(recordOf("a", fill("a", 1, 3, 0)))).toBe(PERCENTAGE_FLOOR);
    });

    it("counts a first-round bye as a round played and won", () => {
      const pairings = [pairing("a", null), ...fill("a", 2, 2, 0)];
      expect(matchWinPct(recordOf("a", pairings))).toBeCloseTo(9 / 15, 10);
    });
  });

  describe("game-win percentage (MTR Appendix C)", () => {
    it("is game points over 3 × games played", () => {
      const pairings = [
        pairing("a", "b", [2, 0, 0]),
        pairing("a", "c", [2, 1, 0]),
        pairing("a", "d", [1, 2, 0]),
        pairing("a", "e", [2, 0, 0]),
      ];
      expect(gameWinPct(recordOf("a", pairings))).toBeCloseTo(21 / 30, 10);
    });

    it("floors a player's own game-win percentage at 0.33", () => {
      const pairings = [
        pairing("a", "b", [1, 2, 0]),
        pairing("a", "c", [1, 2, 0]),
        pairing("a", "d", [0, 2, 0]),
        pairing("a", "e", [1, 2, 0]),
      ];
      const record = recordOf("a", pairings);
      expect(record.gamePoints / (3 * record.gamesPlayed)).toBeCloseTo(9 / 33, 10);
      expect(gameWinPct(record)).toBe(PERCENTAGE_FLOOR);
    });
  });

  describe("opponents' match-win percentage (MTR Appendix C)", () => {
    it("averages the eight opponents, flooring the 1–3–1 at 0.33: ≈0.6164, printed 0.62", () => {
      const pairings = appendixCEvent(false);
      const omw = tiebreakers(runRecords([], pairings), pairings).get(
        "player",
      )?.opponentMatchWinPct;

      const expected = (0.5 + 0.875 + 0.33 + 10 / 21 + 0.75 + 16 / 24 + 13 / 24 + 19 / 24) / 8;
      expect(omw).toBeCloseTo(expected, 12);
      expect(omw).toBeCloseTo(0.6164, 4);
      expect(omw?.toFixed(2)).toBe("0.62");
    });

    it("skips a first-round bye rather than counting it as an opponent: ≈0.6330, printed 0.63", () => {
      const pairings = appendixCEvent(true);
      const records = runRecords([], pairings);
      const omw = tiebreakers(records, pairings).get("player")?.opponentMatchWinPct;

      expect(records.get("player")).toMatchObject({ wins: 6, losses: 2, byes: 1 });
      expect(omw).toBeCloseTo(0.633, 4);
      expect(omw?.toFixed(2)).toBe("0.63");
    });
  });

  it("averages opponents' game-win percentages, each floored at 0.33", () => {
    const pairings = [
      pairing("a", "b", [2, 0, 0]),
      pairing("a", "c", [2, 1, 0]),
      ...fill("c", 2, 0, 0),
    ];
    const ogw = tiebreakers(runRecords([], pairings), pairings).get("a")?.opponentGameWinPct;

    // b: 0 of 6 → floored to 0.33. c: 3 + 12 of 21 game points.
    expect(ogw).toBeCloseTo((0.33 + 15 / 21) / 2, 12);
  });

  it("gives an entrant who has only had a bye the floor, not zero", () => {
    const pairings = [pairing("a", null)];
    expect(tiebreakers(runRecords(["a"], pairings), pairings).get("a")).toEqual({
      opponentMatchWinPct: PERCENTAGE_FLOOR,
      gameWinPct: 1,
      opponentGameWinPct: PERCENTAGE_FLOOR,
    });
  });

  it("ignores a result that has not been confirmed", () => {
    const reported = { ...pairing("a", "b", WIN), status: "reported" as const };
    const result = tiebreakers(runRecords(["a", "b"], [reported]), [reported]);
    expect(result.get("a")?.opponentMatchWinPct).toBe(PERCENTAGE_FLOOR);
  });
});
