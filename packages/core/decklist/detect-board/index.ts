import type { Board } from "@ps/contracts";

/** What one raw line is, before anything tries to read a card out of it. */
export type BoardLine =
  | { readonly kind: "blank" }
  | { readonly kind: "comment" }
  | { readonly kind: "header"; readonly board: Board }
  /** `board` is present only when the line carried its own `SB:` prefix. */
  | { readonly kind: "card"; readonly text: string; readonly board?: Board };

const HEADERS: ReadonlyArray<readonly [RegExp, Board]> = [
  [/^(?:\/\/\s*)?(?:main(?:\s*deck|board)?|deck(?:list)?)\s*:?$/i, "main"],
  [/^(?:\/\/\s*)?(?:side(?:\s*board)?|sb)\s*:?$/i, "side"],
  [/^(?:\/\/\s*)?(?:commander|command(?:\s*zone)?)\s*:?$/i, "command"],
];

/** `SB: 2 Negate (FDN) 710` — the marker rides on the card line itself. */
const INLINE_PREFIXES: ReadonlyArray<readonly [RegExp, Board]> = [
  [/^sb\s*:\s*/i, "side"],
  [/^side\s*:\s*/i, "side"],
  [/^main\s*:\s*/i, "main"],
];

const COMMENT = /^(?:#|\/\/)/;

/** Classifies one line. Strips a BOM and a trailing CR so callers need not. */
export function detectBoard(line: string): BoardLine {
  const text = line.replace(/^﻿/, "").replace(/\r$/, "").trim();

  if (text.length === 0) return { kind: "blank" };

  for (const [pattern, board] of HEADERS) {
    if (pattern.test(text)) return { kind: "header", board };
  }

  for (const [pattern, board] of INLINE_PREFIXES) {
    const rest = text.replace(pattern, "");
    if (rest !== text && rest.length > 0) return { kind: "card", text: rest, board };
  }

  if (COMMENT.test(text)) return { kind: "comment" };

  return { kind: "card", text };
}

/**
 * Whether the document names its boards anywhere.
 *
 * This is what stops a blank line mid-maindeck from opening a sideboard: a file
 * that says `SIDEBOARD:` somewhere is using headers, so its blank lines are
 * spacing rather than structure (E3.3).
 */
export function hasBoardHeader(lines: readonly string[]): boolean {
  return lines.some((line) => {
    const classified = detectBoard(line);
    return (
      classified.kind === "header" || (classified.kind === "card" && classified.board !== undefined)
    );
  });
}
