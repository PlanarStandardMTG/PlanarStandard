import type {
  CardRuling,
  DeckConstraints,
  FormatCardRule,
  FormatVersion,
  OracleId,
} from "@ps/contracts";

/**
 * The `format_*` rows as PostgREST returns them. Kept next to the mappers: outside
 * this module the format is contract types, and the snake_case shape of the
 * tables is nobody else's business.
 */
export interface FormatVersionRow {
  readonly id: string;
  readonly name: string;
  readonly effective_from: string;
  readonly effective_to: string | null;
  readonly notes_markdown: string | null;
  readonly is_current: boolean;
}

export interface CardRuleRow {
  readonly oracle_id: string;
  readonly ruling: CardRuling;
  readonly reason: string | null;
  readonly effective_from: string | null;
}

export interface ConstraintsRow {
  readonly min_maindeck: number;
  readonly max_maindeck: number | null;
  readonly max_sideboard: number;
  readonly max_copies: number;
  readonly singleton: boolean;
  readonly extra_rules: Record<string, unknown> | null;
}

/**
 * A restricted card is limited to one copy. There is no column for it —
 * `format_card_rules` records the ruling, and one is what restricted has meant
 * everywhere it has ever been used.
 */
const RESTRICTED_LIMIT = 1;

export function toFormatVersion(row: FormatVersionRow): FormatVersion {
  return {
    id: row.id,
    name: row.name,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    notesMarkdown: row.notes_markdown,
    isCurrent: row.is_current,
  };
}

export function toCardRule(row: CardRuleRow): FormatCardRule {
  const base = {
    oracleId: row.oracle_id as OracleId,
    reason: row.reason,
    effectiveFrom: row.effective_from,
  };

  return row.ruling === "restricted"
    ? { ...base, ruling: "restricted", limit: RESTRICTED_LIMIT }
    : { ...base, ruling: row.ruling };
}

export function toConstraints(row: ConstraintsRow): DeckConstraints {
  return {
    minMaindeck: row.min_maindeck,
    maxMaindeck: row.max_maindeck,
    maxSideboard: row.max_sideboard,
    maxCopies: row.max_copies,
    singleton: row.singleton,
    extraRules: row.extra_rules ?? {},
  };
}
