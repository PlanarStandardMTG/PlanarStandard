import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  DuplicateMatchAnomaly,
  ImpossibleGameCountAnomaly,
  IsoDate,
  LedgerMatch,
  LedgerResult,
  MatchId,
  PlayerId,
  PlayerRating,
  RatingAnomaly,
  RatingConfig,
  RatingEvent,
  RatingJumpAnomaly,
  ReplayResult,
  SelfPlayAnomaly,
  TournamentId,
} from "./ratings";

// Handles resolved to players at read time, outside core (ADR 003).
// "Zaunus13" and "LikoRS" are two identities bound to one person.
const serlupidus: PlayerId = "c1f0a6e2-8b47-4c35-9d10-2a7e5f3b9c48";
const sunsett: PlayerId = "7d3e9b41-5a26-4f18-8c92-b04a1e6d7f35";
const zaunus13: PlayerId = "2b6c4d80-9e13-4a57-b8f6-3c5d0a2e9147";

const openId: TournamentId = "5e8a2c19-3f64-4b70-9a2d-8c1f6e4b0d73";
const augustOpen: IsoDate = "2026-08-01";

// `rating_config` as the migration seeds it (§12).
const config = {
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
} satisfies RatingConfig;

describe("ratings contracts", () => {
  it("reaches every threshold core/elo needs from one config object", () => {
    expectTypeOf(config).toExtend<RatingConfig>();
    // E8.2 picks K from these three and never from a literal of its own.
    expect([config.kProvisional, config.kStandard, config.kElite]).toEqual([40, 24, 16]);
    expect(config.provisionalMatches).toBeLessThan(config.minMatchesForLeaderboard * 2);
    expectTypeOf<RatingConfig["initialRating"]>().toEqualTypeOf<number>();
    expectTypeOf<RatingConfig["eliteThreshold"]>().toEqualTypeOf<number>();
    expectTypeOf<RatingConfig["inactiveAfterDays"]>().toEqualTypeOf<number>();
    // Byes and elimination rounds are config, not code.
    expectTypeOf<RatingConfig["countByes"]>().toEqualTypeOf<boolean>();
    expectTypeOf<RatingConfig["countEliminationRounds"]>().toEqualTypeOf<boolean>();
  });

  it("names resolved players on a ledger match, never handles", () => {
    const round3 = {
      matchId: "9a41c7d5-2e68-4b03-8f7a-1d5c9e2b4063",
      tournamentId: openId,
      eventDate: augustOpen,
      tournamentWeight: 1.0,
      round: 3,
      p1PlayerId: serlupidus,
      p2PlayerId: sunsett,
      p1Games: 2,
      p2Games: 1,
      gameDraws: 0,
      result: "p1_win",
      isElimination: false,
    } satisfies LedgerMatch;
    expectTypeOf(round3).toExtend<LedgerMatch>();
    expectTypeOf<LedgerMatch>().toHaveProperty("p1PlayerId");
    expectTypeOf<LedgerMatch>().toHaveProperty("p2PlayerId");
    // The replay boundary: nothing handle-shaped survives into core.
    expectTypeOf<LedgerMatch>().not.toHaveProperty("p1Handle");
    expectTypeOf<LedgerMatch>().not.toHaveProperty("p2Handle");
    expectTypeOf<LedgerMatch>().not.toHaveProperty("p1IdentityId");
    expectTypeOf<LedgerMatch>().not.toHaveProperty("p2IdentityId");
    expectTypeOf<LedgerMatch["p1PlayerId"]>().toEqualTypeOf<PlayerId>();
  });

  it("gives two handles of one person the same player id without touching the ledger", () => {
    // Played as "Zaunus13" in July and "LikoRS" in August; a merge changes only
    // what resolution returns, so both matches carry one player id (ADR 003).
    const asZaunus13 = {
      matchId: "4c7b2a90-6d31-4e85-b1f0-7a3e5c9d2846",
      tournamentId: openId,
      eventDate: "2026-07-04",
      tournamentWeight: 1.0,
      round: 1,
      p1PlayerId: zaunus13,
      p2PlayerId: serlupidus,
      p1Games: 1,
      p2Games: 2,
      gameDraws: 0,
      result: "p2_win",
      isElimination: false,
    } satisfies LedgerMatch;
    const asLikoRS = {
      ...asZaunus13,
      matchId: "e05d1b73-4a92-4c68-9f31-6b2a8d0e5c47",
      eventDate: augustOpen,
      round: 2,
      p2PlayerId: sunsett,
      result: "p1_win",
      p1Games: 2,
      p2Games: 0,
    } satisfies LedgerMatch;
    expect(asLikoRS.p1PlayerId).toBe(asZaunus13.p1PlayerId);
    expectTypeOf(asLikoRS).toExtend<LedgerMatch>();
    // Dates are plain ISO strings, which is what makes the tiebreak stable.
    expect(asZaunus13.eventDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expectTypeOf<LedgerMatch["eventDate"]>().toEqualTypeOf<IsoDate>();
  });

  it("represents a bye with no opponent and an elimination round with a double loss", () => {
    const bye = {
      matchId: "1f6e3c08-7b54-4d29-a0c7-9e2b5d4f8136",
      tournamentId: openId,
      eventDate: augustOpen,
      tournamentWeight: 1.0,
      round: 1,
      p1PlayerId: sunsett,
      p2PlayerId: null,
      p1Games: 2,
      p2Games: 0,
      gameDraws: 0,
      result: "bye",
      isElimination: false,
    } satisfies LedgerMatch;
    const doubleLoss = {
      ...bye,
      matchId: "b3d8f512-0c76-4e91-8a45-2f7c6b1d9e08",
      round: 7,
      p2PlayerId: zaunus13,
      p1Games: 1,
      p2Games: 1,
      gameDraws: 1,
      result: "double_loss",
      isElimination: true,
    } satisfies LedgerMatch;
    expectTypeOf(bye).toExtend<LedgerMatch>();
    expectTypeOf<LedgerMatch["p2PlayerId"]>().toEqualTypeOf<PlayerId | null>();
    expect(bye.p2PlayerId).toBeNull();
    expectTypeOf(doubleLoss).toExtend<LedgerMatch>();
    // Whether an elimination round counts is `countEliminationRounds`'s call,
    // not the match's; the flag only reports what the round was.
    expect(doubleLoss.isElimination).toBe(true);
    expect(doubleLoss.gameDraws).toBe(1);
    expectTypeOf<LedgerMatch["result"]>().toEqualTypeOf<LedgerResult>();
    expectTypeOf<LedgerResult>().toEqualTypeOf<
      "p1_win" | "p2_win" | "draw" | "bye" | "double_loss"
    >();
  });

  it("emits one rating event per player per match", () => {
    const matchId: MatchId = "9a41c7d5-2e68-4b03-8f7a-1d5c9e2b4063";
    const winner = {
      playerId: serlupidus,
      matchId,
      tournamentId: openId,
      opponentId: sunsett,
      eventDate: augustOpen,
      ratingBefore: 1500,
      ratingAfter: 1520,
      expectedScore: 0.5,
      actualScore: 1,
      kFactor: 40,
      matchNumber: 1,
    } satisfies RatingEvent;
    const loser = {
      ...winner,
      playerId: sunsett,
      opponentId: serlupidus,
      ratingAfter: 1480,
      actualScore: 0,
      matchNumber: 4,
    } satisfies RatingEvent;
    expectTypeOf(winner).toExtend<RatingEvent>();
    expect(winner.matchId).toBe(loser.matchId);
    expect(winner.expectedScore + loser.expectedScore).toBeCloseTo(1);
    // Provisional K, already multiplied by the flat 1.0 tournament weight.
    expect(winner.kFactor).toBe(config.kProvisional * 1.0);
    // A bye records no opponent.
    expectTypeOf<RatingEvent["opponentId"]>().toEqualTypeOf<PlayerId | null>();
    // matchNumber is per player, so the two rows disagree by design.
    expect(winner.matchNumber).not.toBe(loser.matchNumber);
  });

  it("carries the derived flags and counters on a player rating", () => {
    const unrated = {
      playerId: zaunus13,
      rating: config.initialRating,
      peakRating: config.initialRating,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      tournamentsPlayed: 0,
      lastPlayed: null,
      isProvisional: true,
      isActive: true,
    } satisfies PlayerRating;
    const established = {
      ...unrated,
      playerId: serlupidus,
      rating: 1687,
      peakRating: 1702,
      matchesPlayed: 31,
      wins: 21,
      losses: 8,
      draws: 2,
      tournamentsPlayed: 6,
      lastPlayed: augustOpen,
      isProvisional: false,
    } satisfies PlayerRating;
    expectTypeOf(unrated).toExtend<PlayerRating>();
    // Null, not absent: the column exists on every row.
    expectTypeOf<PlayerRating["lastPlayed"]>().toEqualTypeOf<IsoDate | null>();
    expect(unrated.lastPlayed).toBeNull();
    expect(established.peakRating).toBeGreaterThanOrEqual(established.rating);
    expect(established.wins + established.losses + established.draws).toBe(
      established.matchesPlayed,
    );
    // Off the leaderboard while provisional, whatever the match count (§12).
    expect(unrated.isProvisional).toBe(unrated.matchesPlayed < config.provisionalMatches);
  });

  it("returns anomalies as json-shaped data rather than throwing", () => {
    const selfPlay = {
      kind: "self-play",
      matchId: "3a9c6e27-5b18-4f40-a7d2-0e6b3c9f8154",
      tournamentId: openId,
      detail: "both sides resolved to serlupidus",
      playerId: serlupidus,
    } satisfies SelfPlayAnomaly;
    const duplicate = {
      kind: "duplicate-match-id",
      matchId: "9a41c7d5-2e68-4b03-8f7a-1d5c9e2b4063",
      tournamentId: openId,
      detail: "match id already applied; repeat skipped",
      streamIndex: 412,
    } satisfies DuplicateMatchAnomaly;
    const impossible = {
      kind: "impossible-game-count",
      matchId: "6f2b8d43-1e07-4a95-8c36-5d9a2e7b0c41",
      tournamentId: openId,
      detail: "5-0 in a best-of-three",
      p1Games: 5,
      p2Games: 0,
      gameDraws: 0,
      result: "p1_win",
    } satisfies ImpossibleGameCountAnomaly;
    const jump = {
      kind: "rating-jump",
      matchId: "0d7a5c31-8f62-4b09-9e14-7c3b6d2a5f80",
      tournamentId: openId,
      detail: "single-match delta exceeds the largest configured K",
      playerId: sunsett,
      ratingBefore: 1500,
      ratingAfter: 1622,
      bound: 40,
    } satisfies RatingJumpAnomaly;

    const anomalies: readonly RatingAnomaly[] = [selfPlay, duplicate, impossible, jump];
    expect(anomalies.map((a) => a.kind)).toEqual([
      "self-play",
      "duplicate-match-id",
      "impossible-game-count",
      "rating-jump",
    ]);
    // Bound for a jump comes from the config, recorded on the row.
    expect(jump.bound).toBe(config.kProvisional);
    // They land in `rating_runs.anomalies` (jsonb) untouched.
    expect(JSON.parse(JSON.stringify(anomalies))).toEqual(anomalies);
    expectTypeOf(selfPlay).toExtend<RatingAnomaly>();
    expectTypeOf(duplicate).toExtend<RatingAnomaly>();
    expectTypeOf(impossible).toExtend<RatingAnomaly>();
    expectTypeOf(jump).toExtend<RatingAnomaly>();
  });

  it("returns the rating table, the ordered events and the anomalies together", () => {
    const rating = {
      playerId: serlupidus,
      rating: 1520,
      peakRating: 1520,
      matchesPlayed: 1,
      wins: 1,
      losses: 0,
      draws: 0,
      tournamentsPlayed: 1,
      lastPlayed: augustOpen,
      isProvisional: true,
      isActive: true,
    } satisfies PlayerRating;
    const winnerEvent = {
      playerId: serlupidus,
      matchId: "9a41c7d5-2e68-4b03-8f7a-1d5c9e2b4063",
      tournamentId: openId,
      opponentId: sunsett,
      eventDate: augustOpen,
      ratingBefore: 1500,
      ratingAfter: 1520,
      expectedScore: 0.5,
      actualScore: 1,
      kFactor: 40,
      matchNumber: 1,
    } satisfies RatingEvent;
    const loserEvent = {
      ...winnerEvent,
      playerId: sunsett,
      opponentId: serlupidus,
      ratingAfter: 1480,
      actualScore: 0,
    } satisfies RatingEvent;
    const result = {
      ratings: [
        rating,
        {
          ...rating,
          playerId: sunsett,
          rating: 1480,
          peakRating: 1500,
          wins: 0,
          losses: 1,
        },
      ],
      events: [winnerEvent, loserEvent],
      anomalies: [],
      matchesApplied: 1,
    } satisfies ReplayResult;
    expectTypeOf(result).toExtend<ReplayResult>();
    expectTypeOf<ReplayResult["ratings"]>().toEqualTypeOf<readonly PlayerRating[]>();
    expectTypeOf<ReplayResult["events"]>().toEqualTypeOf<readonly RatingEvent[]>();
    expectTypeOf<ReplayResult["anomalies"]>().toEqualTypeOf<readonly RatingAnomaly[]>();
    // One applied match, two rows in `rating_events`.
    expect(result.matchesApplied).toBe(result.events.length / 2);
    expect(result.ratings).toHaveLength(2);
  });
});
