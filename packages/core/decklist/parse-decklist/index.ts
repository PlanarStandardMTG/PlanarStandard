import type { Board, DeckParseIssue, ParsedDeck, ParsedLine } from "@ps/contracts";

import { detectBoard, hasBoardHeader } from "../detect-board/index";
import { tokenizeLine } from "../tokenize-line/index";

/**
 * Parses a whole decklist document.
 *
 * Never throws and never drops a line: anything that does not tokenize is kept
 * as a `DeckParseIssue` carrying the raw text, so the submitter can be shown
 * exactly what the parser choked on (E3.5).
 */
export function parseDecklist(document: string): ParsedDeck {
  const rawLines = document.replace(/^﻿/, "").split(/\r?\n/);

  // A file that names a board anywhere is using headers, so its blank lines are
  // spacing. Only a file with no header at all lets a blank line open the
  // sideboard — the MTGO export convention.
  const blankLineSeparates = !hasBoardHeader(rawLines);

  const lines: ParsedLine[] = [];
  const issues: DeckParseIssue[] = [];
  let board: Board = "main";
  let seenCardOnBoard = false;

  rawLines.forEach((raw, index) => {
    const lineNumber = index + 1;
    const classified = detectBoard(raw);

    switch (classified.kind) {
      case "comment":
        return;

      case "blank":
        if (blankLineSeparates && board === "main" && seenCardOnBoard) {
          board = "side";
          seenCardOnBoard = false;
        }
        return;

      case "header":
        board = classified.board;
        seenCardOnBoard = false;
        return;

      case "card": {
        const result = tokenizeLine(classified.text);
        if (!result.ok) {
          issues.push({
            code: result.code,
            raw,
            lineNumber,
            column: result.column,
            message: result.message,
          });
          return;
        }
        lines.push({ ...result.token, board: classified.board ?? board, lineNumber });
        seenCardOnBoard = true;
        return;
      }
    }
  });

  return { lines, issues };
}

/** Total cards on a board, counting quantities rather than lines. */
export function countBoard(deck: ParsedDeck, board: Board): number {
  return deck.lines.reduce((total, line) => (line.board === board ? total + line.qty : total), 0);
}
