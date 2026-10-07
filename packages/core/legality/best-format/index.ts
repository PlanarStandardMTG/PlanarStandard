import type { CardIndex, FormatRules, FormatVersionId, ResolvedDeck } from "@ps/contracts";

import { checkDeck } from "../check-deck/index";

export interface BestFormat {
  readonly formatVersionId: FormatVersionId;
  /** False when the deck is legal in none of the event's versions and fell back to the first. */
  readonly legal: boolean;
}

/**
 * The version an event's deck is checked against when the event allowed
 * several (E20.66): the first, in the event's order, it is legal in — or the
 * event's first when it is legal in none. Null when the event has none.
 */
export function bestFormat(
  deck: ResolvedDeck,
  formats: readonly FormatRules[],
  index: CardIndex,
): BestFormat | null {
  const legal = formats.find((rules) => checkDeck(deck, rules, index).legal);
  if (legal !== undefined) return { formatVersionId: legal.formatVersionId, legal: true };
  const first = formats[0];
  return first === undefined ? null : { formatVersionId: first.formatVersionId, legal: false };
}
