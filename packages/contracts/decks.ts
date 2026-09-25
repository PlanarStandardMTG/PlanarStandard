import type { OracleId, SetCode } from "./cards";
import type {
  ArchetypeId,
  DeckId,
  FormatVersionId,
  IsoDateTime,
  JsonValue,
  PlayerId,
  ProfileId,
  SeasonId,
} from "./primitives";

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

// ── The stored deck ──────────────────────────────────────────────────────────
// Everything above is a decklist on its way in. What follows is one after it has
// a row (§14, E13.7).

/**
 * `decks.format` — which rules a deck is built for. Planar Standard is checked
 * against the version in force; Kitchen Table is casual and checks nothing.
 */
export type DeckFormat = "planar_standard" | "kitchen_table";

/** `decks.submitted_via` — how the list reached the site. */
export type DeckSubmissionRoute = "registration" | "organizer" | "backfill" | "import";

/**
 * One `decks` row.
 *
 * `ownerId` and `playerId` are different questions and usually different
 * answers: the owner is an account that can edit this, the player is who
 * registered it. Most decks arrive from an import and have the second and not
 * the first — identities auto-create and curation is merging, not claiming
 * (ADR 009).
 *
 * `archetypeId` and `archetypeRaw` are both kept, always. An adapter reports the
 * label the source printed and never resolves it (E12.7), so the raw string is
 * what lets resolution re-run over a mislabelled deck without going back to a
 * file nobody kept.
 */
export interface Deck {
  readonly id: DeckId;
  readonly name: string;
  readonly ownerId: ProfileId | null;
  readonly playerId: PlayerId | null;
  readonly seasonId: SeasonId | null;
  readonly format: DeckFormat;
  readonly formatVersionId: FormatVersionId | null;
  readonly archetypeId: ArchetypeId | null;
  readonly archetypeRaw: string | null;
  readonly visibility: DeckVisibility;
  readonly descriptionMarkdown: string | null;
  readonly sourceUrl: string | null;
  /** The decklist exactly as it arrived. A parser fix re-runs from here (§26). */
  readonly rawImport: string | null;
  readonly submittedVia: DeckSubmissionRoute | null;
  /** Set when the event starts (ADR 013). After this, an edit forks rather than overwrites. */
  readonly lockedAt: IsoDateTime | null;
  /** The version this one replaced: an edit writes a new deck rather than changing one. */
  readonly parentDeckId: DeckId | null;
  /** Null until legality has been checked, which is not the same as false. */
  readonly isLegal: boolean | null;
  /** The `LegalityVerdict` that produced `isLegal`, as stored. Null when unchecked. */
  readonly validation: JsonValue | null;
  readonly createdAt: IsoDateTime;
}

/**
 * One `deck_cards` row.
 *
 * `name` is the authority and `oracleId` is the lookup: the parser resolves by
 * name, never by printing (ADR 007). `oracleId` is null when the name did not
 * resolve — the row is kept and the deck is flagged (E18.10), because dropping a
 * line the site could not read is how the record stops being a record.
 */
export interface DeckCard {
  readonly oracleId: OracleId | null;
  readonly name: string;
  readonly quantity: number;
  readonly board: Board;
  /** Provenance only. `(PLST) WOE-273` is kept as written and never has to resolve. */
  readonly set: SetCode | null;
  readonly collector: string | null;
}

/** A deck with its list — what a deck page renders, and the only read that needs both. */
export interface DeckWithCards extends Deck {
  readonly cards: readonly DeckCard[];
}
