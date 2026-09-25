import { meleeApi } from "@ps/adapters";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchMeleeResultsInput } from "./results-input.server";

/** Invented players; the same stubbing as `results.server.test.ts`. */
const realFetch = globalThis.fetch;

const tournament = {
  ID: 42,
  Name: "Monthly Championship Series - Test",
  LastPairDateTime: "2026-09-20T18:00:00Z",
  Phases: [
    {
      ID: 1,
      Name: "Swiss Phase",
      SortOrder: 1,
      Rounds: [{ ID: 11, Name: "Round 1", SortOrder: 1 }],
    },
  ],
};
const player = (ID: number, Username: string) => ({
  ID,
  Username,
  FirstName: "Real",
  LastName: "Name",
});
const match = {
  Guid: "m1",
  TournamentId: 42,
  RoundId: 11,
  HasResult: true,
  GameDraws: 0,
  Competitors: [
    { GameWins: 2, Team: { Players: [player(1, "pilot-7")] } },
    { GameWins: 0, Team: { Players: [player(2, "arcane-owl")] } },
  ],
};

beforeEach(() => {
  vi.stubEnv("MELEE_CLIENT_ID", "id");
  vi.stubEnv("MELEE_CLIENT_SECRET", "secret");
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname;
    const body = path.includes("/match/list/")
      ? { StatusCode: 200, HasMore: false, Content: [match] }
      : path.includes("/decklist/list/")
        ? { StatusCode: 200, HasMore: false, Content: [] }
        : tournament;
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = realFetch;
});

describe("lib/melee/results-input", () => {
  it("assembles the scrubbed fetches into what the melee-api adapter reads", async () => {
    const result = await fetchMeleeResultsInput(42);
    if (result.status !== "ok") throw new Error(result.status);

    expect(meleeApi.detect(result.input)).toBe(true);
    const parsed = meleeApi.parse(result.input);
    expect(parsed.name).toBe("Monthly Championship Series - Test");
    expect(parsed.matches?.map((m) => [m.p1Handle, m.p2Handle, m.result])).toEqual([
      ["pilot-7", "arcane-owl", "p1_win"],
    ]);
    expect(result.input.text).not.toContain("Real");
  });

  it("passes a failed fetch through rather than assembling half an event", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("", { status: 503 }),
    ) as typeof globalThis.fetch;

    expect(await fetchMeleeResultsInput(42)).toEqual({
      status: "failed",
      error: "melee responded 503",
    });
  });
});
