import type {
  CardIndex,
  DeckFormat,
  FormatRules,
  LegalityVerdict,
  ResolvedDeck,
} from "@ps/contracts";

import { checkDeck } from "../check-deck/index";

const ANYTHING_GOES: LegalityVerdict = { legal: true, cardIssues: [], deckIssues: [] };

/**
 * A deck against the format it was built for (E20.30).
 *
 * Kitchen Table is casual: any card, any number, any shape, so every deck is
 * legal there. Planar Standard is checked against `rules`, the version in
 * force; null when no version is, since there is then nothing to check against.
 */
export function checkDeckInFormat(
  deck: ResolvedDeck,
  format: DeckFormat,
  rules: FormatRules | null,
  index: CardIndex,
): LegalityVerdict | null {
  if (format === "kitchen_table") return ANYTHING_GOES;
  return rules === null ? null : checkDeck(deck, rules, index);
}
