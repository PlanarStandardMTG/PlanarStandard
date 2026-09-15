// Pure: RawInput in, ParsedEvent out. Depends on contracts + core only.
// The one place a source's idea of "who won" becomes `match_result`.

import type { MatchResult } from "@ps/contracts";

/** What a source can offer: a result cell, per-side game counts, or both. */
export interface ResultCells {
  readonly result?: string | undefined;
  readonly p1Games?: number | undefined;
  readonly p2Games?: number | undefined;
  readonly gameDraws?: number | undefined;
}

export interface NormalizedResult {
  /** `null` when nothing here could be read — the row still stages (§13). */
  readonly result: MatchResult | null;
  readonly p1Games?: number;
  readonly p2Games?: number;
  readonly gameDraws?: number;
}

/** Whole-cell spellings, matched after lower-casing and collapsing punctuation. */
const WORDS: Readonly<Record<string, MatchResult>> = {
  w: "p1_win",
  win: "p1_win",
  won: "p1_win",
  p1: "p1_win",
  p1win: "p1_win",
  player1: "p1_win",
  player1win: "p1_win",
  l: "p2_win",
  loss: "p2_win",
  lose: "p2_win",
  lost: "p2_win",
  p2: "p2_win",
  p2win: "p2_win",
  player2: "p2_win",
  player2win: "p2_win",
  d: "draw",
  draw: "draw",
  drawn: "draw",
  tie: "draw",
  tied: "draw",
  // An intentional draw. Both players agree not to play; it is a draw in the
  // standings and the pairing is real, so it rates like any other draw.
  id: "draw",
  intentionaldraw: "draw",
  bye: "bye",
  byewin: "bye",
  dl: "double_loss",
  doubleloss: "double_loss",
  doubledq: "double_loss",
};

const SCORE = /^(\d+)\D+(\d+)(?:\D+(\d+))?$/;

/**
 * A source cell to a canonical result.
 *
 * Reports `null` rather than guessing. A bare `1` is the clearest case: it is
 * "player 1 won" in one export and "one game won" in the next, and picking
 * wrong writes a fabricated match into the ledger, where nothing downstream can
 * tell it from a real one.
 */
export function normalizeResult(cells: ResultCells): NormalizedResult {
  const games = fromGames(cells);
  if (games !== null) return games;

  const cell = (cells.result ?? "").trim();
  if (cell === "") return { result: null };

  const word = WORDS[cell.toLowerCase().replace(/[^a-z0-9]/gi, "")];
  if (word !== undefined) return { result: word };

  const score = SCORE.exec(cell);
  if (score === null) return { result: null };

  return (
    fromGames({
      p1Games: Number(score[1]),
      p2Games: Number(score[2]),
      ...(score[3] === undefined ? {} : { gameDraws: Number(score[3]) }),
    }) ?? { result: null }
  );
}

function fromGames(cells: ResultCells): NormalizedResult | null {
  const p1 = asCount(cells.p1Games);
  const p2 = asCount(cells.p2Games);
  if (p1 === null || p2 === null) return null;

  const draws = asCount(cells.gameDraws);
  // 0-0 is a round that was never played, not a draw — a dropped player's
  // remaining rounds come through a melee export exactly like this.
  const result: MatchResult | null =
    p1 > p2 ? "p1_win" : p2 > p1 ? "p2_win" : p1 === 0 && (draws ?? 0) === 0 ? null : "draw";

  return {
    result,
    p1Games: p1,
    p2Games: p2,
    ...(draws === null ? {} : { gameDraws: draws }),
  };
}

function asCount(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
}
