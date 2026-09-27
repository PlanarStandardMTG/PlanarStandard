import { readFileSync } from "node:fs";
import type { RawInput } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { detectAdapter } from "../registry/index";
import { challongeApi } from "./index";

const read = (name: string): string =>
  readFileSync(new URL(`../../../fixtures/challonge-api/${name}`, import.meta.url), "utf8");

const upload = (payload: unknown): RawInput => {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return { fileName: "challonge-results.json", bytes: new TextEncoder().encode(text), text };
};

const BUNDLE = JSON.parse(read("results-bundle.json")) as Record<string, unknown>;

const match = (
  id: string,
  round: number,
  identifier: string,
  player1Id: string,
  player2Id: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  state: "complete",
  round,
  identifier,
  player1Id,
  player2Id,
  winnerId: player1Id,
  gamesByParticipant: { [player1Id]: 2, [player2Id]: 0 },
  scores: "2 - 0",
  tie: false,
  ...extra,
});

describe("adapters/challonge-api", () => {
  it("reads the invented event into its expected ParsedEvent", () => {
    expect(challongeApi.parse(upload(BUNDLE))).toEqual(
      JSON.parse(read("results-bundle.expected.json")),
    );
  });

  it("is the adapter the registry picks for its own payload, and only for that", () => {
    const detected = detectAdapter(upload(BUNDLE));
    expect(detected.outcome === "matched" && detected.adapter.id).toBe("challonge-api");

    expect(challongeApi.detect(upload({ ...BUNDLE, adapter: "melee-api" }))).toBe(false);
    expect(challongeApi.detect(upload(read("community-tournaments.json")))).toBe(false);
    expect(challongeApi.detect(upload("not json"))).toBe(false);
  });

  it("lets the reported winner stand over a score that disagrees or is missing", () => {
    const results = challongeApi.parse(upload(BUNDLE)).matches?.map((m) => [m.raw["id"], m.result]);

    expect(results).toContainEqual(["9004", "p1_win"]);
    expect(results).toContainEqual(["9005", "p1_win"]);
  });

  it("records a participant with no account under a stable stand-in, never their name", () => {
    const parsed = challongeApi.parse(upload(BUNDLE));

    expect(parsed.roster?.map((r) => r.handle)).toContain("challonge-player-505");
    expect(parsed.issues.map((i) => i.code)).toContain("missing-username");
  });

  it("never claims decklists", () => {
    expect(challongeApi.parse(upload(BUNDLE)).capabilities).toEqual([
      "matches",
      "standings",
      "roster",
    ]);
  });

  it("replays a two-stage event's bracket after its groups, from where identifiers restart", () => {
    const parsed = challongeApi.parse(
      upload({
        ...BUNDLE,
        tournament: {
          ...(BUNDLE["tournament"] as object),
          tournamentType: "single elimination",
          groupStageEnabled: true,
        },
        matches: [
          match("g1", 1, "A", "501", "502"),
          match("g2", 1, "B", "503", "504"),
          match("g3", 2, "C", "501", "503"),
          match("f1", 1, "A", "501", "504"),
          match("f2", 2, "B", "501", "502"),
        ],
      }),
    );

    expect(parsed.structure).toBe("groups + single elimination");
    expect(parsed.matches?.map((m) => [m.raw["id"], m.round, m.isElimination])).toEqual([
      ["g1", 1, false],
      ["g2", 1, false],
      ["g3", 2, false],
      ["f1", 3, true],
      ["f2", 4, true],
    ]);
  });

  it("places a losers' bracket round with its winners' round", () => {
    const parsed = challongeApi.parse(
      upload({
        ...BUNDLE,
        tournament: { ...(BUNDLE["tournament"] as object), tournamentType: "double elimination" },
        matches: [match("w1", 1, "A", "501", "502"), match("l1", -1, "B", "503", "504")],
      }),
    );

    expect(parsed.matches?.map((m) => [m.round, m.isElimination])).toEqual([
      [1, true],
      [1, true],
    ]);
  });

  it("does not read a payload with no tournament", () => {
    expect(challongeApi.parse(upload({ adapter: "challonge-api" })).issues[0]?.code).toBe(
      "unreadable-payload",
    );
  });
});
