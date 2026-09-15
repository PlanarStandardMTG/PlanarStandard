import type { CardIndex, MvBucket, MvBuckets, ResolvedDeck } from "@ps/contracts";

import { entriesOn, isLand } from "../shared";

const EMPTY: MvBuckets = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7+": 0 };

/**
 * Maindeck mana-value histogram, **non-lands only**.
 *
 * Lands are excluded because a curve is about what you are casting; including
 * them would put a quarter of every deck in a bucket it does not belong to.
 *
 * Buckets are 1-6 and 7+, per §8.3. A zero-cost non-land therefore lands in
 * bucket 1 — the plan's bucket list has nowhere else for it, and the pool has
 * very few such cards. If that stops being true, the fix is a "0" bucket in the
 * contract, not a silent reinterpretation here.
 */
export function manaCurve(deck: ResolvedDeck, index: CardIndex): MvBuckets {
  const buckets: Record<MvBucket, number> = { ...EMPTY };
  for (const { entry, card } of entriesOn(deck, index, "main")) {
    if (isLand(card)) continue;
    buckets[bucketFor(card.manaValue)] += entry.qty;
  }
  return buckets;
}

export function bucketFor(manaValue: number): MvBucket {
  const rounded = Math.max(1, Math.round(manaValue));
  if (rounded >= 7) return "7+";
  return String(rounded) as MvBucket;
}
