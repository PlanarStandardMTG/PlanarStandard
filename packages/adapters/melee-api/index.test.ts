import { readFileSync } from "node:fs";
import type { RawInput } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { detectAdapter } from "../registry/index";
import { meleeApi } from "./index";

const read = (name: string): string =>
  readFileSync(new URL(`../../../fixtures/melee-api/${name}`, import.meta.url), "utf8");

const upload = (payload: unknown): RawInput => {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return { fileName: "melee-results.json", bytes: new TextEncoder().encode(text), text };
};

const BUNDLE = JSON.parse(read("results-bundle.json")) as Record<string, unknown>;

const player = (id: number, username: string | null) => ({ id, username });
const side = (id: number, gameWins: number, username: string | null = `p${id}`) => ({
  players: [player(id, username)],
  gameWins,
});

describe("adapters/melee-api", () => {
  it("reads the invented event into its expected ParsedEvent", () => {
    expect(meleeApi.parse(upload(BUNDLE))).toEqual(
      JSON.parse(read("results-bundle.expected.json")),
    );
  });

  it("is the adapter the registry picks for its own payload, and only for that", () => {
    const detected = detectAdapter(upload(BUNDLE));
    expect(detected.outcome === "matched" && detected.adapter.id).toBe("melee-api");

    expect(meleeApi.detect(upload({ ...BUNDLE, adapter: "manual-entry" }))).toBe(false);
    expect(meleeApi.detect(upload(read("tournament-list.json")))).toBe(false);
    expect(meleeApi.detect(upload("not json"))).toBe(false);
  });

  it("numbers rounds across phases, so a cut replays after the Swiss", () => {
    const parsed = meleeApi.parse(upload(BUNDLE));
    const rounds = parsed.matches?.map((m) => [m.round, m.isElimination]);

    expect(rounds?.at(0)).toEqual([1, false]);
    expect(rounds?.at(-1)).toEqual([5, true]);
  });

  it("records a player without a username under a stable stand-in, never a guess", () => {
    const parsed = meleeApi.parse(upload(BUNDLE));

    expect(parsed.roster?.map((r) => r.handle)).toContain("melee-player-105");
    expect(parsed.issues.map((i) => i.code)).toContain("missing-username");
  });

  it("does not claim standings or decklists for an event where nobody submitted a list", () => {
    const parsed = meleeApi.parse(upload({ ...BUNDLE, decklists: [] }));

    expect(parsed.capabilities).toEqual(["matches", "roster"]);
    expect("standings" in parsed).toBe(false);
    expect("decklists" in parsed).toBe(false);
  });

  it("never infers pairings from standings", () => {
    const parsed = meleeApi.parse(upload({ ...BUNDLE, matches: [] }));

    expect(parsed.capabilities).not.toContain("matches");
    expect("matches" in parsed).toBe(false);
    expect(parsed.standings).toHaveLength(3);
    expect(parsed.issues.map((i) => i.code)).toContain("no-matches");
  });

  it("refuses a team match rather than rating one of its players", () => {
    const team = {
      guid: "t",
      roundId: 11,
      hasResult: true,
      gameDraws: 0,
      competitors: [{ players: [player(1, "a"), player(2, "b")], gameWins: 2 }, side(3, 0)],
    };
    const parsed = meleeApi.parse(upload({ ...BUNDLE, matches: [team] }));

    expect(parsed.matches).toBeUndefined();
    expect(parsed.issues.map((i) => i.code)).toContain("unreadable-pairing");
  });

  it("stages a 0-0 match for review rather than calling it a draw", () => {
    const parsed = meleeApi.parse(
      upload({
        ...BUNDLE,
        matches: [
          {
            guid: "x",
            roundId: 11,
            hasResult: true,
            gameDraws: 0,
            competitors: [side(1, 0), side(2, 0)],
          },
        ],
      }),
    );

    expect(parsed.matches?.[0]?.result).toBeNull();
  });

  it("reports an unreadable payload as an issue, not a throw", () => {
    const parsed = meleeApi.parse(upload({ adapter: "melee-api" }));

    expect(parsed.capabilities).toEqual([]);
    expect(parsed.issues[0]?.code).toBe("unreadable-payload");
  });
});
