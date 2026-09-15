import type { CardIndex, DeckId, DeckMetrics, FormatRules, IsoDateTime, ResolvedDeck } from "@ps/contracts";

import { averageMv } from "../average-mv/index";
import { colorCounts, colorIdentity } from "../color-counts/index";
import { manaCurve } from "../mana-curve/index";
import { rarityCounts } from "../rarity-counts/index";
import { setAttribution } from "../set-attribution/index";
import { typeCounts } from "../type-counts/index";

export interface ComputeOptions {
  /** Stamped onto the row. Passed in because core has no clock. */
  readonly computedAt: IsoDateTime;
}

/**
 * Composes every deck metric into one `deck_metrics` row.
 *
 * Counts `unresolvedCards` rather than hiding them: a non-zero count excludes
 * the deck from `card_stats` until someone fixes the name (E18.10), so it has to
 * travel with the metrics rather than being worked out again downstream.
 */
export function computeDeckMetrics(
  deckId: DeckId,
  deck: ResolvedDeck,
  index: CardIndex,
  rules: FormatRules,
  options: ComputeOptions,
): DeckMetrics {
  const averages = averageMv(deck, index);

  return {
    deckId,
    maindeckCount: countBoard(deck, "main"),
    sideboardCount: countBoard(deck, "side"),
    avgMvInclLands: averages.inclLands,
    avgMvExclLands: averages.exclLands,
    avgMvSideboard: averages.sideboard,
    totalMv: averages.totalMv,
    mvBuckets: manaCurve(deck, index),
    colorCounts: colorCounts(deck, index),
    colorIdentity: colorIdentity(deck, index),
    typeCounts: typeCounts(deck, index),
    setCounts: setAttribution(deck, index, rules),
    rarityCounts: rarityCounts(deck, index, rules),
    unresolvedCards: deck.cards.reduce(
      (total, card) => (card.oracleId === null ? total + card.qty : total),
      0,
    ),
    computedAt: options.computedAt,
  };
}

function countBoard(deck: ResolvedDeck, board: ResolvedDeck["cards"][number]["board"]): number {
  return deck.cards.reduce((total, card) => (card.board === board ? total + card.qty : total), 0);
}
