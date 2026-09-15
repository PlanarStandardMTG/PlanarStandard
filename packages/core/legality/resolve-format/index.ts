import type {
  DeckConstraints,
  FormatCardRule,
  FormatRules,
  FormatVersionId,
  OracleId,
  SetCode,
} from "@ps/contracts";

import { normalizeSetCode } from "../build-card-index/index";

/** Standard constraints, from Part IX answer 2. Overridden per format version. */
export const DEFAULT_CONSTRAINTS: DeckConstraints = {
  minMaindeck: 60,
  maxMaindeck: null,
  maxSideboard: 15,
  maxCopies: 4,
  singleton: false,
  extraRules: {},
};

export interface FormatVersionRows {
  readonly formatVersionId: FormatVersionId;
  readonly legalSets: readonly SetCode[];
  readonly cardRules: readonly FormatCardRule[];
  readonly constraints?: DeckConstraints;
}

/**
 * The four `format_*` tables collapsed into one object the checkers read without
 * another query.
 *
 * Set and Map rather than arrays, so a check is a lookup rather than a scan —
 * `check-deck` asks about every card in a 75.
 */
export function resolveFormat(rows: FormatVersionRows): FormatRules {
  const legalSets = new Set<SetCode>(rows.legalSets.map(normalizeSetCode));
  const cardRules = new Map<OracleId, FormatCardRule>();
  for (const rule of rows.cardRules) cardRules.set(rule.oracleId, rule);

  return {
    formatVersionId: rows.formatVersionId,
    legalSets,
    cardRules,
    constraints: rows.constraints ?? DEFAULT_CONSTRAINTS,
  };
}
