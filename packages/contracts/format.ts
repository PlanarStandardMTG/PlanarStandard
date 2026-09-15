import type { OracleId, SetCode } from "./cards";
import type { Board } from "./decks";
import type { IsoDate } from "./primitives";

export type FormatVersionId = string;

/** A `format_versions` row (§14). */
export interface FormatVersion {
  readonly id: FormatVersionId;
  readonly name: string;
  readonly effectiveFrom: IsoDate;
  readonly effectiveTo: IsoDate | null;
  readonly notesMarkdown: string | null;
  readonly isCurrent: boolean;
}

/** The `card_ruling` enum. */
export type CardRuling = "banned" | "restricted" | "legal_exception";

interface CardRuleBase {
  readonly oracleId: OracleId;
  readonly reason: string | null;
  readonly effectiveFrom: IsoDate | null;
}

/**
 * A `format_card_rules` row. `limit` has no column behind it: `resolve-format` supplies the
 * format's restricted limit so `check-card` never has to know the convention.
 */
export type FormatCardRule =
  | (CardRuleBase & { readonly ruling: "banned" })
  | (CardRuleBase & { readonly ruling: "restricted"; readonly limit: number })
  | (CardRuleBase & { readonly ruling: "legal_exception" });

/** A `format_constraints` row. */
export interface DeckConstraints {
  readonly minMaindeck: number;
  readonly maxMaindeck: number | null;
  readonly maxSideboard: number;
  readonly maxCopies: number;
  readonly singleton: boolean;
  readonly extraRules: Readonly<Record<string, unknown>>;
}

/**
 * The four `format_*` tables flattened by `resolve-format` (E5.3) — everything the checkers
 * read, with no further queries. Set and Map so a check is a lookup, not a scan.
 */
export interface FormatRules {
  readonly formatVersionId: FormatVersionId;
  readonly legalSets: ReadonlySet<SetCode>;
  readonly cardRules: ReadonlyMap<OracleId, FormatCardRule>;
  readonly constraints: DeckConstraints;
}

/**
 * The four `format_*` tables as rows, before `resolve-format` (E5.3) flattens them
 * into `FormatRules`. This is what `repos/format` returns and what `/rules`
 * renders; `constraints` is null when a version has no row of its own and the
 * format's defaults apply.
 */
export interface FormatVersionDetail {
  readonly version: FormatVersion;
  readonly legalSets: readonly SetCode[];
  readonly cardRules: readonly FormatCardRule[];
  readonly constraints: DeckConstraints | null;
}

interface CardIssueBase {
  readonly kind: "card";
  readonly cardName: string;
  /** null when the name never resolved — the row is kept and the deck flagged (§26). */
  readonly oracleId: OracleId | null;
  /** Plural because the copy limit counts maindeck and sideboard together. */
  readonly boards: readonly Board[];
  readonly message: string;
}

/** One card is not legal. Decided on the oracle card, never the printing (ADR 007). */
export type CardIssue =
  | (CardIssueBase & { readonly code: "unresolved_name" })
  | (CardIssueBase & { readonly code: "not_in_pool" })
  | (CardIssueBase & { readonly code: "banned" })
  /** `limit` is the format's `maxCopies`, or the card's own limit when it is restricted. */
  | (CardIssueBase & {
      readonly code: "over_copy_limit";
      readonly copies: number;
      readonly limit: number;
    });

interface DeckIssueBase {
  readonly kind: "deck";
  readonly message: string;
}

/** The deck's shape is wrong, whatever the individual cards are. */
export type DeckIssue =
  | (DeckIssueBase & {
      readonly code: "maindeck_too_small";
      readonly count: number;
      readonly minimum: number;
    })
  | (DeckIssueBase & {
      readonly code: "maindeck_too_large";
      readonly count: number;
      readonly maximum: number;
    })
  | (DeckIssueBase & {
      readonly code: "sideboard_too_large";
      readonly count: number;
      readonly maximum: number;
    })
  | (DeckIssueBase & {
      readonly code: "singleton_violated";
      readonly cardNames: readonly string[];
    });

export type Issue = CardIssue | DeckIssue;

export type IssueCode = Issue["code"];

/**
 * What `check-deck` (E5.5) returns: every issue found, never just the first, with the two
 * families kept apart so a caller can render card problems and shape problems separately.
 */
export interface LegalityVerdict {
  /** False while any issue stands — an unresolved name leaves legality unproven, not proven. */
  readonly legal: boolean;
  readonly cardIssues: readonly CardIssue[];
  readonly deckIssues: readonly DeckIssue[];
}
