import type {
  CardIndex,
  FormatRules,
  OracleId,
  ResolvedDeck,
  SetCode,
  SetCounts,
} from "@ps/contracts";

import { normalizeSetCode } from "../../legality/build-card-index/index";
import { entriesOn } from "../shared";

/**
 * Attributes each card to its **legal** set, not its printed one.
 *
 * The subtle one (§8.3). `Llanowar Elves (M19)` counts as FDN, because M19 is not
 * in the pool and FDN is — the question "did the new set change anything" is
 * about which set made the card available, and a player's choice of printing has
 * nothing to do with that.
 *
 * **Tiebreak:** a card legal through two sets is attributed to whichever comes
 * first in the format's declared legal-set order. That order is
 * `format_legal_sets` as the admin entered it, which makes the tiebreak
 * community-controlled rather than alphabetical chance.
 */
export function setAttribution(
  deck: ResolvedDeck,
  index: CardIndex,
  rules: FormatRules,
): SetCounts {
  const order = [...rules.legalSets];
  const counts: Record<SetCode, number> = {};

  for (const { entry, card } of entriesOn(deck, index, "main")) {
    const setCode = attributedSet(card.setCodes, order);
    if (setCode === null) continue;
    counts[setCode] = (counts[setCode] ?? 0) + entry.qty;
  }

  return counts;
}

/** The legal set a single card is attributed to, or null when none of its sets is legal. */
export function attributeCard(
  oracleId: OracleId,
  index: CardIndex,
  rules: FormatRules,
): SetCode | null {
  const card = index.byOracleId.get(oracleId)?.card;
  if (card === undefined) return null;
  return attributedSet(card.setCodes, [...rules.legalSets]);
}

function attributedSet(setCodes: readonly SetCode[], order: readonly SetCode[]): SetCode | null {
  const legal = new Set(setCodes.map(normalizeSetCode));
  for (const candidate of order) {
    if (legal.has(candidate)) return candidate;
  }
  return null;
}
