import { describe, expect, it } from "vitest";

import { normalizeResult } from "./index";

describe("adapters/normalize-result", () => {
  it("reads a score cell in either direction", () => {
    expect(normalizeResult({ result: "2-1" })).toEqual({
      result: "p1_win",
      p1Games: 2,
      p2Games: 1,
    });
    expect(normalizeResult({ result: "1-2" })).toEqual({
      result: "p2_win",
      p1Games: 1,
      p2Games: 2,
    });
  });

  it("reads a three-part score as a draw when the games are level", () => {
    expect(normalizeResult({ result: "1-1-1" })).toEqual({
      result: "draw",
      p1Games: 1,
      p2Games: 1,
      gameDraws: 1,
    });
  });

  it("accepts the separators exports actually use", () => {
    for (const cell of ["2-1", "2 - 1", "2/1", "2:1", "2 to 1"]) {
      expect(normalizeResult({ result: cell }).result).toBe("p1_win");
    }
  });

  it("reads the words", () => {
    expect(normalizeResult({ result: "Win" }).result).toBe("p1_win");
    expect(normalizeResult({ result: " LOSS " }).result).toBe("p2_win");
    expect(normalizeResult({ result: "Draw" }).result).toBe("draw");
    expect(normalizeResult({ result: "ID" }).result).toBe("draw");
    expect(normalizeResult({ result: "Bye" }).result).toBe("bye");
    expect(normalizeResult({ result: "double loss" }).result).toBe("double_loss");
  });

  it("prefers mapped game counts over the result cell", () => {
    expect(normalizeResult({ result: "win", p1Games: 0, p2Games: 2 })).toEqual({
      result: "p2_win",
      p1Games: 0,
      p2Games: 2,
    });
  });

  it("refuses to guess a bare number", () => {
    expect(normalizeResult({ result: "1" }).result).toBeNull();
    expect(normalizeResult({ result: "0" }).result).toBeNull();
  });

  it("reads 0-0 as a round never played, not a draw", () => {
    expect(normalizeResult({ result: "0-0" }).result).toBeNull();
    expect(normalizeResult({ p1Games: 0, p2Games: 0 }).result).toBeNull();
    // ...unless the draws column says games were played and split.
    expect(normalizeResult({ p1Games: 0, p2Games: 0, gameDraws: 3 }).result).toBe("draw");
  });

  it("reports nothing readable rather than inventing a result", () => {
    expect(normalizeResult({})).toEqual({ result: null });
    expect(normalizeResult({ result: "" })).toEqual({ result: null });
    expect(normalizeResult({ result: "see notes" })).toEqual({ result: null });
  });

  it("ignores half a pair of game columns", () => {
    expect(normalizeResult({ result: "2-1", p1Games: 2 })).toEqual({
      result: "p1_win",
      p1Games: 2,
      p2Games: 1,
    });
  });

  it("floors fractional game counts and ignores negative ones", () => {
    expect(normalizeResult({ p1Games: 2.7, p2Games: 1 }).p1Games).toBe(2);
    expect(normalizeResult({ p1Games: -1, p2Games: 1 }).result).toBeNull();
  });
});
