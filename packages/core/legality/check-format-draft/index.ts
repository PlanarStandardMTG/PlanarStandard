import type {
  CardIndex,
  CardRuleDraft,
  CardRuling,
  FormatVersionDraft,
  IsoDate,
  SetCode,
} from "@ps/contracts";

import { resolveCardName } from "../resolve-card-name/index";

/**
 * Whether what an admin typed is a format version that can be saved (E20.33).
 *
 * Card rules are written by name and saved by oracle id, so a name that does not
 * resolve is a problem with suggestions, never a guess. Blank rule rows are the
 * form's spare rows and are skipped. Problems are codes; the page words them.
 */
export const FORMAT_NAME_MAX = 80;
export const CARD_RULINGS: readonly CardRuling[] = ["banned", "restricted", "legal_exception"];

export interface CardRuleInput {
  readonly cardName: string;
  readonly ruling: string;
  readonly reason: string;
  readonly effectiveFrom: string;
}

export interface FormatDraftInput {
  readonly name: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly notes: string;
  readonly isCurrent: boolean;
  readonly legalSets: readonly string[];
  readonly minMaindeck: string;
  readonly maxMaindeck: string;
  readonly maxSideboard: string;
  readonly maxCopies: string;
  readonly singleton: boolean;
  readonly cardRules: readonly CardRuleInput[];
}

type NumberField = "minMaindeck" | "maxMaindeck" | "maxSideboard" | "maxCopies";

export type FormatDraftProblem =
  | { readonly field: "name"; readonly code: "empty" | "long" }
  | { readonly field: "effectiveFrom"; readonly code: "invalid" }
  | { readonly field: "effectiveTo"; readonly code: "invalid" | "before-start" }
  | { readonly field: "legalSets"; readonly code: "empty" }
  | { readonly field: "legalSets"; readonly code: "invalid"; readonly set: string }
  | { readonly field: NumberField; readonly code: "invalid" }
  | { readonly field: "maxMaindeck"; readonly code: "below-minimum" }
  | {
      readonly field: "cardRules";
      readonly code: "unknown-card";
      readonly row: number;
      readonly name: string;
      readonly suggestions: readonly string[];
    }
  | {
      readonly field: "cardRules";
      readonly code: "duplicate";
      readonly row: number;
      readonly name: string;
    }
  | {
      readonly field: "cardRules";
      readonly code: "invalid-ruling" | "invalid-date";
      readonly row: number;
    };

export type FormatDraftCheck =
  | { readonly ok: true; readonly value: FormatVersionDraft }
  | { readonly ok: false; readonly problems: readonly FormatDraftProblem[] };

const SET_CODE = /^[A-Za-z0-9]{2,6}$/;
const WHOLE = /^\d+$/;

export function isIsoDate(value: string): value is IsoDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function checkFormatDraft(input: FormatDraftInput, index: CardIndex): FormatDraftCheck {
  const problems: FormatDraftProblem[] = [];

  const name = input.name.trim();
  if (name.length === 0) problems.push({ field: "name", code: "empty" });
  else if (name.length > FORMAT_NAME_MAX) problems.push({ field: "name", code: "long" });

  const effectiveFrom = input.effectiveFrom.trim();
  if (!isIsoDate(effectiveFrom)) problems.push({ field: "effectiveFrom", code: "invalid" });
  const effectiveTo = input.effectiveTo.trim();
  if (effectiveTo !== "" && !isIsoDate(effectiveTo)) {
    problems.push({ field: "effectiveTo", code: "invalid" });
  } else if (effectiveTo !== "" && isIsoDate(effectiveFrom) && effectiveTo < effectiveFrom) {
    problems.push({ field: "effectiveTo", code: "before-start" });
  }

  const legalSets = [...new Set(input.legalSets.map((s) => s.trim().toUpperCase()))].filter(
    (s) => s !== "",
  );
  if (legalSets.length === 0) problems.push({ field: "legalSets", code: "empty" });
  for (const set of legalSets) {
    if (!SET_CODE.test(set)) problems.push({ field: "legalSets", code: "invalid", set });
  }

  const whole = (field: NumberField, value: string, minimum: number): number | null => {
    const trimmed = value.trim();
    if (!WHOLE.test(trimmed) || Number(trimmed) < minimum) {
      problems.push({ field, code: "invalid" });
      return null;
    }
    return Number(trimmed);
  };
  const minMaindeck = whole("minMaindeck", input.minMaindeck, 1);
  const maxMaindeck =
    input.maxMaindeck.trim() === "" ? null : whole("maxMaindeck", input.maxMaindeck, 1);
  const maxSideboard = whole("maxSideboard", input.maxSideboard, 0);
  const maxCopies = whole("maxCopies", input.maxCopies, 1);
  if (minMaindeck !== null && maxMaindeck !== null && maxMaindeck < minMaindeck) {
    problems.push({ field: "maxMaindeck", code: "below-minimum" });
  }

  const cardRules: CardRuleDraft[] = [];
  const seen = new Set<string>();
  input.cardRules.forEach((rule, row) => {
    const cardName = rule.cardName.trim();
    if (cardName === "") return;

    const ruling = CARD_RULINGS.find((r) => r === rule.ruling);
    if (ruling === undefined) problems.push({ field: "cardRules", code: "invalid-ruling", row });
    const from = rule.effectiveFrom.trim();
    if (from !== "" && !isIsoDate(from)) {
      problems.push({ field: "cardRules", code: "invalid-date", row });
    }

    const resolution = resolveCardName(cardName, index);
    if (!resolution.ok) {
      problems.push({
        field: "cardRules",
        code: "unknown-card",
        row,
        name: cardName,
        suggestions: resolution.candidates.map((c) => c.name),
      });
      return;
    }
    if (seen.has(resolution.oracleId)) {
      problems.push({ field: "cardRules", code: "duplicate", row, name: resolution.name });
      return;
    }
    seen.add(resolution.oracleId);
    if (ruling !== undefined) {
      cardRules.push({
        oracleId: resolution.oracleId,
        ruling,
        reason: rule.reason.trim() === "" ? null : rule.reason.trim(),
        effectiveFrom: isIsoDate(from) ? from : null,
      });
    }
  });

  if (
    problems.length > 0 ||
    !isIsoDate(effectiveFrom) ||
    minMaindeck === null ||
    maxSideboard === null ||
    maxCopies === null
  ) {
    return { ok: false, problems };
  }

  return {
    ok: true,
    value: {
      name,
      effectiveFrom,
      effectiveTo: isIsoDate(effectiveTo) ? effectiveTo : null,
      notesMarkdown: input.notes.trim() === "" ? null : input.notes.trim(),
      isCurrent: input.isCurrent,
      legalSets: legalSets as SetCode[],
      constraints: {
        minMaindeck,
        maxMaindeck,
        maxSideboard,
        maxCopies,
        singleton: input.singleton,
      },
      cardRules,
    },
  };
}
