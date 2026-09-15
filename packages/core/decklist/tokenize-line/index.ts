import type { DeckParseIssueCode, ParsedLine } from "@ps/contracts";

/** What one card line carries before `parse-decklist` assigns it a board and a line number. */
export type LineToken = Pick<ParsedLine, "qty" | "name" | "set" | "collector" | "foil">;

export type TokenizeResult =
  | { readonly ok: true; readonly token: LineToken }
  | {
      readonly ok: false;
      readonly code: DeckParseIssueCode;
      /** 1-based column of the offending token. */
      readonly column: number;
      readonly message: string;
    };

/**
 * The grammar, as the real corpus writes it:
 *
 *     <qty>[x] <name>[ (<set>) <collector>][ *F*]
 *
 * `(SET) COLLECTOR` is optional and absent on 321 distinct real lines. Collector
 * numbers are alphanumeric and may carry a hyphen or a star — `11p`, `72s`,
 * `KLD-5`, `M19-54`, `ml233`, `9★` — so they are never parsed as numbers.
 */
const LINE = new RegExp(
  "^(?<qty>\\d+)\\s*[xX]?\\s+" +
    "(?<name>\\S.*?)" +
    "(?:\\s+\\((?<set>[A-Za-z0-9]{2,6})\\)\\s+(?<collector>[^\\s]+))?" +
    "(?<foil>\\s+\\*F\\*)?" +
    "\\s*$",
);

const LEADING_QUANTITY = /^\s*(\d+)\s*[xX]?(\s|$)/;

/**
 * Tokenizes one decklist line.
 *
 * Returns a typed failure with the offending column rather than throwing —
 * `parse-decklist` keeps the bad line as an issue instead of dropping it (E3.5).
 * Board headers and blank lines are `detect-board`'s job and must be filtered
 * out before a line reaches here.
 */
export function tokenizeLine(line: string): TokenizeResult {
  const text = line.replace(/^﻿/, "").replace(/\r$/, "");
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return { ok: false, code: "unrecognized-line", column: 1, message: "the line is empty" };
  }

  if (!LEADING_QUANTITY.test(text)) {
    const column = text.length - text.trimStart().length + 1;
    return /^\s*\d/.test(text)
      ? {
          ok: false,
          code: "invalid-quantity",
          column,
          message: `expected a quantity followed by a space, got ${JSON.stringify(trimmed.slice(0, 12))}`,
        }
      : {
          ok: false,
          code: "missing-quantity",
          column,
          message: `expected a line to start with a quantity, got ${JSON.stringify(trimmed.slice(0, 12))}`,
        };
  }

  const match = LINE.exec(text);
  const groups = match?.groups;
  if (groups === undefined) {
    return {
      ok: false,
      code: "missing-card-name",
      column: (LEADING_QUANTITY.exec(text)?.[0].length ?? 0) + 1,
      message: "a quantity with no card name after it",
    };
  }

  const qty = Number(groups["qty"]);
  if (qty === 0) {
    return { ok: false, code: "invalid-quantity", column: 1, message: "a quantity of zero" };
  }

  const name = (groups["name"] ?? "").trim();
  const set = groups["set"];
  const collector = groups["collector"];

  // `set` and `collector` are omitted, never set to undefined — the contract is
  // compiled with exactOptionalPropertyTypes.
  return {
    ok: true,
    token: {
      qty,
      name,
      foil: groups["foil"] !== undefined,
      ...(set === undefined ? {} : { set }),
      ...(collector === undefined ? {} : { collector }),
    },
  };
}
