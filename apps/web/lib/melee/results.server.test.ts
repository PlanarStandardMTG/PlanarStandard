import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getDecklist,
  getTournament,
  getTournamentDecklists,
  getTournamentMatches,
  scrubDecklist,
  scrubMatch,
  scrubTournament,
} from "./results.server";

/**
 * Invented players throughout — never a captured response, which would put the
 * personal data this module exists to drop into the repository. Every field
 * melee is known to send about a person is here, plus one it does not send yet,
 * and none of their values may survive a scrub.
 */
const PERSONAL = {
  FirstName: "Ada",
  LastName: "Lovelace",
  Name: "Ada Lovelace",
  NameLastFirst: "Lovelace, Ada",
  DisplayName: "adal",
  DisplayNameLastFirst: "adal",
  Username: "adal-user",
  ScreenName: "adal#11111",
  ArenaScreenName: "adal#11111",
  MtgoScreenName: "adal-mtgo",
  DiscordUsername: "adal-discord",
  Email: "ada@example.test",
  PronounsDescription: "She/Her",
  DciNumber: "999000111",
  NotYetInvented: "a field melee adds next year",
};
const LEAKS = Object.values(PERSONAL);

function assertNoPersonalData(value: unknown) {
  const text = JSON.stringify(value);
  for (const leak of LEAKS) expect(text).not.toContain(leak);
}

const rawMatch = {
  Guid: "match-1",
  TournamentId: 42,
  PhaseId: 7,
  RoundId: 70,
  RoundNumber: 3,
  HasResult: true,
  GameDraws: 0,
  TypeDescription: "Best of Three",
  ResultString: "adal won 2-1-0",
  AdminResultString: "Lovelace, Ada won 2-1-0",
  Competitors: [
    {
      TeamId: 900,
      GameWins: 2,
      GameByes: 0,
      Team: { ID: 900, Players: [{ ID: 1001, TeamId: 900, ...PERSONAL }] },
      Decklists: [{ DecklistId: "deck-1", PlayerId: 1001, DecklistName: "Bant" }],
    },
  ],
};

const rawDecklist = {
  Guid: "deck-1",
  TournamentId: 42,
  PlayerId: 1001,
  TeamId: 900,
  FormatId: "fmt",
  FormatName: "Standard",
  DecklistName: "Bant",
  IsValid: true,
  TeamRank: 3,
  TeamMatchWins: 3,
  TeamMatchLosses: 1,
  TeamMatchDraws: 0,
  OwnerFirstName: PERSONAL.FirstName,
  OwnerLastName: PERSONAL.LastName,
  OwnerNameFirstLast: PERSONAL.Name,
  OwnerNameLastFirst: PERSONAL.NameLastFirst,
  OwnerUsername: PERSONAL.Username,
  OwnerDisplayName: PERSONAL.DisplayName,
  OwnerPronounsDescription: PERSONAL.PronounsDescription,
  DiscordUsername: PERSONAL.DiscordUsername,
  TwitchChannel: PERSONAL.NotYetInvented,
  Attributes: [
    { k: "COLOR_BLUE", v: "True", p: null },
    { k: "ARCHETYPE", v: "Artifacts", p: 1 },
  ],
  Records: [
    { l: "island", n: "Island", s: null, q: 22, c: 0, t: "Land" },
    { l: "negate", n: "Negate", s: null, q: 2, c: 99, t: "Instant" },
    { l: "odd", n: "Odd Card", s: null, q: 1, c: 7, t: "Instant" },
  ],
};

describe("lib/melee/results — scrubbing", () => {
  it("keeps a match's result and melee ids, and no person", () => {
    const match = scrubMatch(rawMatch);

    expect(match).toEqual({
      guid: "match-1",
      tournamentId: 42,
      phaseId: 7,
      roundId: 70,
      roundNumber: 3,
      hasResult: true,
      gameDraws: 0,
      type: "Best of Three",
      byeReason: null,
      competitors: [
        { playerIds: [1001], teamId: 900, gameWins: 2, gameByes: 0, decklistIds: ["deck-1"] },
      ],
    });
    assertNoPersonalData(match);
  });

  it("keeps a decklist's cards, standing and melee player id, and no person", () => {
    const decklist = scrubDecklist(rawDecklist);

    expect(decklist).toMatchObject({
      guid: "deck-1",
      playerId: 1001,
      deckName: "Bant",
      archetypes: ["Artifacts"],
      rank: 3,
      matchWins: 3,
      cards: [
        { name: "Island", quantity: 22, board: "main" },
        { name: "Negate", quantity: 2, board: "side" },
        { name: "Odd Card", quantity: 1, board: "other" },
      ],
    });
    assertNoPersonalData(decklist);
  });

  it("keeps a tournament's structure, trimming its name", () => {
    const tournament = scrubTournament({
      ID: 42,
      Name: "Weekly #3 ",
      StatusDescription: "Ended",
      Formats: ["Standard"],
      Phases: [
        {
          ID: 7,
          Name: "Swiss",
          FormatId: "fmt",
          Format: "Standard",
          SortOrder: 1,
          Rounds: [{ ID: 70, Name: "Round 1", SortOrder: 1 }],
        },
      ],
      StaffNotes: PERSONAL.NotYetInvented,
    });

    expect(tournament?.name).toBe("Weekly #3");
    expect(tournament?.phases[0]?.rounds).toEqual([{ id: 70, name: "Round 1", sortOrder: 1 }]);
    assertNoPersonalData(tournament);
  });

  it("drops what it cannot identify rather than guessing", () => {
    expect(scrubMatch({ Guid: "no-tournament" })).toBeNull();
    expect(scrubDecklist("not an object")).toBeNull();
    expect(scrubTournament({ Name: "no id" })).toBeNull();
  });
});

describe("lib/melee/results — the wrapped calls", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv("MELEE_CLIENT_ID", "test-id");
    vi.stubEnv("MELEE_CLIENT_SECRET", "test-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.fetch = realFetch;
  });

  function respond(content: unknown[]) {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ StatusCode: 200, HasMore: false, Content: content }), {
          status: 200,
        }),
    ) as typeof globalThis.fetch;
  }

  it("hands back scrubbed matches and decklists, never the payload", async () => {
    respond([rawMatch]);
    const matches = await getTournamentMatches(42);
    expect(matches.status === "ok" && matches.value.map((m) => m.guid)).toEqual(["match-1"]);
    assertNoPersonalData(matches);

    respond([rawDecklist]);
    const decklists = await getTournamentDecklists(42);
    expect(decklists.status === "ok" && decklists.value[0]?.playerId).toBe(1001);
    assertNoPersonalData(decklists);
  });

  function record() {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input));
      const page = Number(new URL(String(input)).searchParams.get("variables.page") ?? "1");
      return new Response(
        JSON.stringify(
          new URL(String(input)).pathname.includes("/list/")
            ? { StatusCode: 200, HasMore: page < 2, Content: [{ ...rawMatch, Guid: `m${page}` }] }
            : { ID: 42, Guid: "deck-1", Name: "Weekly", Phases: [] },
        ),
        { status: 200 },
      );
    }) as typeof globalThis.fetch;
    return calls;
  }

  it("calls the endpoints melee's Swagger names, and reads every page of a list", async () => {
    const calls = record();

    const tournament = await getTournament(42);
    const matches = await getTournamentMatches(42);
    await getDecklist("4c9ecc65-77aa-40d8-9e8e-b48c00fd09c0");

    expect(calls.map((c) => new URL(c).pathname)).toEqual([
      "/api/tournament/42",
      "/api/match/list/42",
      "/api/match/list/42",
      "/api/decklist/4c9ecc65-77aa-40d8-9e8e-b48c00fd09c0",
    ]);
    expect(tournament.status === "ok" && tournament.value.name).toBe("Weekly");
    expect(matches.status === "ok" && matches.value.map((m) => m.guid)).toEqual(["m1", "m2"]);
  });

  it("passes a failed or unconfigured fetch through unchanged", async () => {
    vi.stubEnv("MELEE_CLIENT_ID", "");
    expect(await getTournamentMatches(42)).toEqual({ status: "not-configured" });
  });

  it("fails an unrecognised shape rather than returning something partial", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ StatusCode: 200, Oops: true }), { status: 200 }),
    ) as typeof globalThis.fetch;

    expect((await getTournamentDecklists(42)).status).toBe("failed");
  });
});
