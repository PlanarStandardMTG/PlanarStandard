// Ingestion contracts (§9, §13, §26). An adapter is pure: RawInput in,
// ParsedEvent out. No platform is special (ADR 005).

import type { IsoDate } from "./primitives";

/** `result_imports.adapter_id`. Persisted, so it outlives a rename. */
export type AdapterId = string;

// The ledger's own ids (§13). Declared here because this is the module that owns
// seasons, tournaments and matches; identity, ratings and metrics all import them.
export type SeasonId = string;
export type TournamentId = string;
export type MatchId = string;

/**
 * What a parse can yield. Gating is load-bearing (ADR 006): Elo consumes
 * `matches` only, a standings-only import is unrated, and pairings are never
 * inferred from placements.
 */
export type Capability = "matches" | "standings" | "roster" | "decklists";

/** The `tournament_status` enum (§13). */
export type TournamentStatus =
  "draft" | "awaiting_results" | "results_imported" | "verified" | "archived";

/** The `import_status` enum (§13). `superseded` is what a re-import does to its predecessor (§26). */
export type ImportStatus =
  "uploaded" | "parsed" | "resolved" | "needs_review" | "committed" | "failed" | "superseded";

/** The `match_result` enum, verbatim — these values are written to Postgres. */
export type MatchResult = "p1_win" | "p2_win" | "draw" | "bye" | "double_loss";

/**
 * One source row as the adapter read it, kept in `staged_matches.raw` so a
 * parser fix can re-run without the original file (§26). Flat by design: a CSV
 * row, a spreadsheet row, or a scraped node's attributes.
 */
export type RawRow = {
  readonly [column: string]: string | number | boolean | null;
};

export type ParseIssueSeverity = "error" | "warning";

/**
 * Adapters report bad input as data rather than throwing, so one unreadable row
 * never costs the rest of the file. `code` is an open string: a new adapter
 * brings new codes without a contract change.
 */
export interface ParseIssue {
  readonly code: string;
  readonly severity: ParseIssueSeverity;
  /** Actionable, shown to the operator — E12.1's "unrecognized format" text. */
  readonly message: string;
  /** Zero-based source row, mirroring `staged_matches.row_index`. */
  readonly rowIndex?: number;
  readonly column?: string;
}

/** A source column: its header, or a zero-based index when there is no header row. */
export type ColumnRef = string | number;

/** The canonical fields an operator can point a source column at (E12.2). */
export type MappableField =
  | "round"
  | "tableNumber"
  | "p1Handle"
  | "p2Handle"
  | "p1Games"
  | "p2Games"
  | "gameDraws"
  | "result"
  | "isElimination"
  | "handle"
  | "placement"
  | "matchWins"
  | "matchLosses"
  | "matchDraws"
  | "gameWins"
  | "gameLosses"
  | "dropped";

/** Persisted verbatim to `result_imports.column_mapping` so a re-import needs no re-mapping. */
export type ColumnMapping = {
  readonly [Field in MappableField]?: ColumnRef;
};

/**
 * An upload before anyone knows its format. `bytes` is the authority: adapters
 * do no I/O, so the whole file is in hand before `detect` runs. `text` is a
 * decode the caller already had (paste, CSV upload) — a CSV adapter uses it and
 * skips decoding, an xlsx adapter ignores it.
 */
export interface RawInput {
  readonly fileName: string;
  /** Declared by the upload; absent when the client sent none. */
  readonly mediaType?: string;
  readonly bytes: Uint8Array;
  readonly text?: string;
  /** Present only for adapters that cannot infer their own columns. */
  readonly columnMapping?: ColumnMapping;
}

/**
 * The staging shape of one pairing (`staged_matches`). Handles, never player
 * ids — resolution happens after staging (ADR 003, E18.3).
 */
export interface ParsedMatch {
  /** Zero-based position in the source, unique per import. */
  readonly rowIndex: number;
  readonly raw: RawRow;
  readonly p1Handle: string;
  /** Absent on a bye — there is no opponent to record. */
  readonly p2Handle?: string;
  /**
   * `null` when the source cell could not be normalized. The row still stages,
   * carrying a ParseIssue, which is why `staged_matches.result` is `text` and
   * not the enum.
   */
  readonly result: MatchResult | null;
  /** Omitted by sources that report no round or table structure. */
  readonly round?: number;
  readonly tableNumber?: number;
  readonly p1Games?: number;
  readonly p2Games?: number;
  readonly gameDraws?: number;
  readonly isElimination?: boolean;
}

/** One row of the final standings (`tournament_entries`), keyed by handle. */
export interface ParsedStanding {
  readonly handle: string;
  readonly placement?: number;
  readonly matchWins?: number;
  readonly matchLosses?: number;
  readonly matchDraws?: number;
  readonly gameWins?: number;
  readonly gameLosses?: number;
  readonly dropped?: boolean;
}

/** A registered player, with whatever the source printed alongside the handle. */
export interface ParsedRosterEntry {
  readonly handle: string;
  readonly displayName?: string;
  readonly deckName?: string;
  /** The archetype label as printed; matched to an archetype later, never trusted as one. */
  readonly archetypeRaw?: string;
  readonly decklistUrl?: string;
}

/** A decklist recovered from the source — E12.7 reads all of this out of one hover tooltip. */
export interface ParsedDecklistEntry {
  readonly handle: string;
  /** Present when the list is dated independently of the event. */
  readonly date?: IsoDate;
  /**
   * Both records exactly as printed (`3-1`, `6-3`). Parsing that grammar
   * belongs to `core/decklist/parse-filename`, which already owns it (§8.1).
   */
  readonly matchRecord?: string;
  readonly gameRecord?: string;
  /** Unparsed decklist text, stored as `decks.raw_import`. */
  readonly decklistText: string;
  readonly deckName?: string;
  readonly archetypeRaw?: string;
}

/**
 * The canonical output of every adapter. Payloads are optional so a
 * standings-only source returns standings and nothing else — an empty
 * `matches` array would read as "this event had no pairings", which is how
 * ratings get silently corrupted.
 */
export interface ParsedEvent {
  /** Best-effort event metadata (`tournaments`); most adapters discover only some of it. */
  readonly name?: string;
  /** `tournaments.event_date`. */
  readonly date?: IsoDate;
  readonly platform?: string;
  readonly externalUrl?: string;
  readonly structure?: string;
  readonly rounds?: number;
  readonly playerCount?: number;
  /** What this parse actually produced, not what the adapter can do. */
  readonly capabilities: readonly Capability[];
  readonly matches?: readonly ParsedMatch[];
  readonly standings?: readonly ParsedStanding[];
  readonly roster?: readonly ParsedRosterEntry[];
  readonly decklists?: readonly ParsedDecklistEntry[];
  readonly issues: readonly ParseIssue[];
}

/** Implemented once per source, in `packages/adapters`. Pure and side-effect free. */
export interface ResultsAdapter {
  readonly id: AdapterId;
  /** Everything this adapter can produce — a superset of any single parse. */
  readonly capabilities: readonly Capability[];
  detect(input: RawInput): boolean;
  parse(input: RawInput): ParsedEvent;
}

/**
 * What the registry returns after running every `detect` (E12.1). Ambiguity is
 * an outcome the operator resolves, never registration order.
 */
export type AdapterDetection =
  | { readonly outcome: "matched"; readonly adapter: ResultsAdapter }
  | { readonly outcome: "unrecognized"; readonly issue: ParseIssue }
  | {
      readonly outcome: "ambiguous";
      readonly candidates: readonly ResultsAdapter[];
      readonly issue: ParseIssue;
    };
