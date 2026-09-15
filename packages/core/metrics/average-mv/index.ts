import type { CardIndex, ResolvedDeck } from "@ps/contracts";

import { entriesOn, isLand } from "../shared";

export interface AverageMv {
  /** Maindeck, lands counted at their mana value. */
  readonly inclLands: number | null;
  /** Maindeck non-lands only — the number people mean by "average mana value". */
  readonly exclLands: number | null;
  readonly sideboard: number | null;
  /** Total mana value of the maindeck, lands included. */
  readonly totalMv: number | null;
}

/**
 * Average mana value, three ways.
 *
 * Copy-weighted: four copies of a one-drop pull the average four times, because
 * the question is what the deck's mana looks like, not what its card list does.
 *
 * `null` rather than `0` for an empty board. A deck with no sideboard has no
 * average sideboard mana value, and charting that as 0.0 would be a lie.
 */
export function averageMv(deck: ResolvedDeck, index: CardIndex): AverageMv {
  const main = entriesOn(deck, index, "main");
  const side = entriesOn(deck, index, "side");
  const nonLands = main.filter(({ card }) => !isLand(card));

  const mainTotal = weightedTotal(main);
  const mainCount = weightedCount(main);

  return {
    inclLands: mean(mainTotal, mainCount),
    exclLands: mean(weightedTotal(nonLands), weightedCount(nonLands)),
    sideboard: mean(weightedTotal(side), weightedCount(side)),
    totalMv: mainCount === 0 ? null : mainTotal,
  };
}

function weightedTotal(entries: ReadonlyArray<{ entry: { qty: number }; card: { manaValue: number } }>): number {
  return entries.reduce((total, { entry, card }) => total + card.manaValue * entry.qty, 0);
}

function weightedCount(entries: ReadonlyArray<{ entry: { qty: number } }>): number {
  return entries.reduce((total, { entry }) => total + entry.qty, 0);
}

function mean(total: number, count: number): number | null {
  return count === 0 ? null : total / count;
}
