import type { OracleId, SetCode } from "./cards";

/** The `deck_visibility` enum (§14). */
export type DeckVisibility = "private" | "unlisted" | "public";

/** Which pile a line fell on. Mirrors the `deck_cards.board` check constraint (§14). */
export type Board = "main" | "side" | "command";

/**
 * A win-loss-draw record. Not named `Record` — that would shadow the built-in utility type.
 *
 * `draws` is absent, not zero, when the source omitted it: the `GW-GL` game segment of a
 * decklist filename is a pair, and plenty of `W-L` match records carry no draw component.
 */
export interface WinLossDraw {
  readonly wins: number;
  readonly losses: number;
  readonly draws?: number;
}

/**
 * One tokenized decklist line (`core/decklist/tokenize-line`).
 *
 * `set` and `collector` are optional because bare `4 Lightning Bolt` lines are
 * common; they are omitted rather than empty-stringed. Collector numbers are
 * alphanumeric (`25p`, `WOE-273`), never numeric.
 */
export interface ParsedLine {
  readonly qty: number;
  /** The card name exactly as printed on the line. Normalization happens downstream. */
  readonly name: string;
  readonly set?: SetCode;
  readonly collector?: string;
  readonly foil: boolean;
  readonly board: Board;
  /** 1-based index into the source document, so an issue can name the offending line. */
  readonly lineNumber: number;
}

export type DeckParseIssueCode =
  | "missing-quantity"
  | "invalid-quantity"
  | "missing-card-name"
  | "malformed-set-code"
  | "malformed-collector-number"
  | "unrecognized-line";

/** An unparseable line, retained rather than dropped (E3.5). */
export interface DeckParseIssue {
  readonly code: DeckParseIssueCode;
  /** The line verbatim, so the UI can show the user what it choked on. */
  readonly raw: string;
  readonly lineNumber: number;
  /** 1-based column of the offending token, where the tokenizer can localize it (E3.2). */
  readonly column?: number;
  readonly message: string;
}

/** A whole decklist document after `core/decklist/parse-decklist`. */
export interface ParsedDeck {
  readonly lines: readonly ParsedLine[];
  readonly issues: readonly DeckParseIssue[];
}

/**
 * A `ParsedLine` after `core/legality/resolve-card-name`.
 *
 * `oracleId` is null — not absent — when the name did not resolve: the row is kept,
 * the deck is flagged, and it is excluded from `card_stats` until fixed (E18.10).
 * `set`/`collector` survive as provenance and never have to resolve (§14.1, ADR 007).
 */
export interface ResolvedCard {
  readonly qty: number;
  readonly name: string;
  readonly oracleId: OracleId | null;
  readonly set?: SetCode;
  readonly collector?: string;
  readonly foil: boolean;
  readonly board: Board;
  readonly lineNumber: number;
  /** Ranked "did you mean" candidates, present only on a miss (E5.2). */
  readonly candidates?: readonly ResolutionCandidate[];
}

export interface ResolutionCandidate {
  readonly oracleId: OracleId;
  readonly name: string;
  /** 0–1; higher is closer. Exact matches never produce candidates. */
  readonly score: number;
}

export interface ResolvedDeck {
  readonly cards: readonly ResolvedCard[];
  readonly issues: readonly DeckParseIssue[];
  /** True when any card carries a null `oracleId`. */
  readonly hasUnresolvedCards: boolean;
}

/**
 * `Player (alias)｜Deck｜Archetype｜W-L-D｜GW-GL` (E3.6).
 *
 * Trailing segments are frequently missing, so everything past the player is optional.
 * `alias` is split out of the player segment because `core/identity/signals/parenthetical`
 * mines it (E9.2).
 */
export interface DecklistFilenameMeta {
  /** The player segment with any trailing parenthetical removed. */
  readonly player: string;
  readonly alias?: string;
  readonly deckName?: string;
  readonly archetype?: string;
  readonly matchRecord?: WinLossDraw;
  readonly gameRecord?: WinLossDraw;
}
