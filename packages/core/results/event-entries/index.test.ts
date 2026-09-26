import type { ParsedMatch } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { eventEntries } from "./index";

let row = 0;
const match = (
  round: number,
  p1Handle: string,
  p2Handle: string | undefined,
  result: ParsedMatch["result"],
  isElimination = false,
): ParsedMatch => ({
  rowIndex: row++,
  raw: {},
  p1Handle,
  ...(p2Handle === undefined ? {} : { p2Handle }),
  result,
  round,
  p1Games: result === "p1_win" ? 2 : result === "p2_win" ? 1 : 0,
  p2Games: result === "p2_win" ? 2 : result === "p1_win" ? 1 : 0,
  isElimination,
});

// Two Swiss rounds, then a top 4.
const swiss = [
  match(1, "ann", "bea", "p1_win"),
  match(1, "cat", "dan", "draw"),
  match(1, "eve", undefined, "bye"),
  match(2, "ann", "cat", "p2_win"),
];
const playoff = [
  match(3, "ann", "dan", "p1_win", true),
  match(3, "cat", "bea", "p2_win", true),
  match(4, "ann", "bea", "p2_win", true),
];

const byHandle = (entries: ReturnType<typeof eventEntries>) =>
  Object.fromEntries(entries.map((e) => [e.handle, e]));

describe("core/results/eventEntries", () => {
  it("reads a top 4 off a clean playoff when the source reported no standings", () => {
    const entries = byHandle(eventEntries({ matches: [...swiss, ...playoff] }));

    expect(entries["bea"]?.placement).toBe(1);
    expect(entries["ann"]?.placement).toBe(2);
    expect(entries["cat"]?.placement).toBe(3);
    expect(entries["dan"]?.placement).toBe(3);
    expect(entries["eve"]?.placement).toBeNull();
  });

  it("tallies records from the pairings, a bye as a win", () => {
    const entries = byHandle(eventEntries({ matches: swiss }));

    expect(entries["ann"]).toMatchObject({ matchWins: 1, matchLosses: 1, gameWins: 3 });
    expect(entries["cat"]).toMatchObject({ matchWins: 1, matchDraws: 1 });
    expect(entries["eve"]).toMatchObject({ matchWins: 1, gameWins: 0 });
  });

  it("gives no placements when the playoff is not a clean bracket", () => {
    const lopsided = [...playoff, match(3, "eve", "zed", "p1_win", true)];
    const entries = eventEntries({ matches: [...swiss, ...lopsided] });

    expect(entries.filter((e) => e.placement === 1)).toHaveLength(1);
    expect(byHandle(entries)["eve"]?.placement).toBeNull();
  });

  it("prefers the source's standings, and ignores the bracket once it has them", () => {
    const entries = byHandle(
      eventEntries({
        matches: [...swiss, ...playoff],
        standings: [{ handle: "cat", placement: 1, matchWins: 4, dropped: false }],
      }),
    );

    expect(entries["cat"]).toMatchObject({ placement: 1, matchWins: 4 });
    expect(entries["bea"]?.placement).toBeNull();
  });

  it("includes a player the standings name who never played a match", () => {
    const entries = eventEntries({ standings: [{ handle: "ghost", placement: 9, dropped: true }] });
    expect(entries).toEqual([
      {
        handle: "ghost",
        placement: 9,
        matchWins: 0,
        matchLosses: 0,
        matchDraws: 0,
        gameWins: 0,
        gameLosses: 0,
        dropped: true,
      },
    ]);
  });
});
