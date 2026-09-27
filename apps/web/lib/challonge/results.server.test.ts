import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getMatches, getParticipants, getTournament } from "./results.server";

/**
 * Every response here is invented, in the v2.1 shape, and deliberately full of
 * what a real one carries about people — the point is what comes back out.
 */
const realFetch = globalThis.fetch;

const PARTICIPANT = {
  id: "501",
  type: "participant",
  attributes: {
    name: "Jane Doe",
    username: "pilot-7",
    email_hash: "0f3c",
    challonge_email_address_verified: true,
    invite_email: "jane@example.com",
    icon: "https://example.com/avatar.png",
    misc: "Discord: jane#1234",
    seed: 1,
    final_rank: 1,
    group_id: 8506842,
    checked_in: true,
  },
};

const MATCH = {
  id: "9001",
  type: "match",
  attributes: {
    state: "complete",
    round: 2,
    identifier: "A",
    suggested_play_order: 4,
    scores: "2 - 1",
    score_in_sets: [[2, 1]],
    points_by_participant: [
      { participant_id: 501, scores: [2] },
      { participant_id: 502, scores: [1] },
    ],
    winner_id: 501,
    timestamps: { created_at: "2026-08-02T18:00:00.000Z" },
  },
  relationships: {
    player1: { data: { id: "501", type: "participant" } },
    player2: { data: { id: "502", type: "participant" } },
  },
};

/** One page of `members`, then empty pages. */
function stubPages(members: readonly unknown[]) {
  const calls: string[] = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    calls.push(String(input));
    const page = Number(new URL(String(input)).searchParams.get("page") ?? "1");
    return new Response(JSON.stringify({ data: page === 1 ? members : [] }), { status: 200 });
  }) as typeof globalThis.fetch;
  return calls;
}

beforeEach(() => {
  vi.stubEnv("CHALLONGE_API_KEY", "test-key");
  vi.stubEnv("CHALLONGE_COMMUNITY", "planarstandardmtg");
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = realFetch;
});

describe("lib/challonge/results", () => {
  it("keeps a participant's id, username and rank, and nothing that names a person", async () => {
    stubPages([PARTICIPANT]);

    const result = await getParticipants("16049001");

    expect(result).toEqual({
      status: "ok",
      value: [{ id: "501", username: "pilot-7", finalRank: 1 }],
    });
    const text = JSON.stringify(result);
    for (const leaked of ["Jane", "example.com", "jane#1234", "0f3c"]) {
      expect(text).not.toContain(leaked);
    }
  });

  it("reads a match's players, winner and games per participant", async () => {
    stubPages([MATCH]);

    expect(await getMatches("16049001")).toEqual({
      status: "ok",
      value: [
        {
          id: "9001",
          state: "complete",
          round: 2,
          identifier: "A",
          player1Id: "501",
          player2Id: "502",
          winnerId: "501",
          gamesByParticipant: { "501": 2, "502": 1 },
          scores: "2 - 1",
          tie: false,
        },
      ],
    });
  });

  it("stops at a short page, under the community", async () => {
    const calls = stubPages([MATCH]);

    await getMatches("16049001");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/communities/planarstandardmtg/tournaments/16049001/matches.json");
  });

  it("reads the tournament's name, type and dates", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              id: "16049001",
              type: "tournament",
              attributes: {
                name: "Monthly",
                url: "ps_monthly",
                tournament_type: "swiss",
                state: "complete",
                starts_at: "2026-08-02T18:00:00.000Z",
                timestamps: { completed_at: "2026-08-02T23:41:12.000Z" },
                group_stage_enabled: true,
                description: "Hosted by Jane Doe",
              },
            },
          }),
          { status: 200 },
        ),
    ) as typeof globalThis.fetch;

    expect(await getTournament("16049001")).toEqual({
      status: "ok",
      value: {
        id: "16049001",
        name: "Monthly",
        url: "ps_monthly",
        tournamentType: "swiss",
        state: "complete",
        startsAt: "2026-08-02T18:00:00.000Z",
        completedAt: "2026-08-02T23:41:12.000Z",
        groupStageEnabled: true,
      },
    });
  });

  it("reports not-configured without the key", async () => {
    vi.stubEnv("CHALLONGE_API_KEY", "");

    expect(await getMatches("1")).toEqual({ status: "not-configured" });
  });
});
