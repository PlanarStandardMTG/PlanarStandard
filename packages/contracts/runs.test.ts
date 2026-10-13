import { describe, expectTypeOf, it } from "vitest";

import type {
  Run,
  RunEntrant,
  RunPairing,
  RunRecord,
  RunRound,
  RunStanding,
  RunState,
  RunStructure,
} from "./runs";

describe("runs contracts", () => {
  it("names a run's life in six states", () => {
    expectTypeOf<RunState>().toEqualTypeOf<
      "draft" | "registration" | "running" | "top_cut" | "finished" | "cancelled"
    >();
  });

  it("lets the organizer choose any shape, down to straight single elimination", () => {
    const knockout = { swissRounds: 0, topCut: 8 } satisfies RunStructure;
    const run = {
      id: "6b0e4c1a-2d3f-4a5b-8c9d-0e1f2a3b4c5d",
      name: "Planar Standard Weekly #42",
      startsAt: "2026-10-17T19:00:00.000Z",
      description: null,
      formatVersionIds: ["b7c1d2e3-4f5a-4b6c-8d7e-9f0a1b2c3d4e"],
      tournamentId: null,
      organizerId: "9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a",
      state: "registration",
      seed: "3c9a7f21",
      ...knockout,
    } satisfies Run;
    expectTypeOf(run).toExtend<Run>();
  });

  it("holds a member under their profile handle and a guest under none", () => {
    const member = {
      id: "e1",
      runId: "r1",
      profileId: "9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a",
      displayName: "Brayzon",
      handle: "brayzon",
      checkedIn: true,
      droppedAfterRound: null,
    } satisfies RunEntrant;
    const guest = {
      id: "e2",
      runId: "r1",
      profileId: null,
      displayName: "Walk-in Sam",
      handle: null,
      checkedIn: true,
      droppedAfterRound: 2,
    } satisfies RunEntrant;
    expectTypeOf([member, guest]).toExtend<readonly RunEntrant[]>();
  });

  it("numbers rounds through the whole run", () => {
    const firstCutRound = {
      id: "rd6",
      runId: "r1",
      number: 6,
      kind: "elimination",
      pairedAt: "2026-10-17T20:30:00.000Z",
    } satisfies RunRound;
    expectTypeOf(firstCutRound).toExtend<RunRound>();
  });

  it("records an intentional draw as games and a bye as no opponent", () => {
    const intentionalDraw = {
      id: "p1",
      roundId: "rd5",
      round: 5,
      table: 1,
      p1EntrantId: "e1",
      p2EntrantId: "e3",
      games: { p1Wins: 0, p2Wins: 0, draws: 3 },
      status: "confirmed",
    } satisfies RunPairing;
    const bye = {
      id: "p9",
      roundId: "rd1",
      round: 1,
      table: 9,
      p1EntrantId: "e2",
      p2EntrantId: null,
      games: null,
      status: "confirmed",
    } satisfies RunPairing;
    expectTypeOf([intentionalDraw, bye]).toExtend<readonly RunPairing[]>();
  });

  it("carries the record a standing line is built on", () => {
    const standing = {
      entrantId: "e1",
      matchPoints: 18,
      wins: 6,
      losses: 2,
      draws: 0,
      byes: 0,
      roundsPlayed: 8,
      gamePoints: 39,
      gamesPlayed: 19,
      rank: 3,
      opponentMatchWinPct: 0.6164,
      gameWinPct: 0.6842,
      opponentGameWinPct: 0.5521,
      dropped: false,
    } satisfies RunStanding;
    expectTypeOf(standing).toExtend<RunRecord>();
  });
});
