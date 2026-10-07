import type { CardIndex, FormatRules, FormatVersionId, ResolvedDeck } from "@ps/contracts";

import { checkDeck } from "../check-deck/index";

/**
 * The version an event's deck is checked against when the event allowed
 * several (E20.66): the first, in the event's order, it is legal in — or the
 * event's first when it is legal in none. Null when the event has none.
 */
export function bestFormat(
  deck: ResolvedDeck,
  formats: readonly FormatRules[],
  index: CardIndex,
): FormatVersionId | null {
  const legal = formats.find((rules) => checkDeck(deck, rules, index).legal);
  return (legal ?? formats[0])?.formatVersionId ?? null;
}
