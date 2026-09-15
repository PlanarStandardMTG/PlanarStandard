import type { CardIndex, CardTypeBucket, OracleCard, ResolvedDeck, TypeCounts } from "@ps/contracts";

import { entriesOn } from "../shared";

const EMPTY: TypeCounts = {
  Land: 0,
  Creature: 0,
  Instant: 0,
  Sorcery: 0,
  Artifact: 0,
  Enchantment: 0,
  Planeswalker: 0,
  Battle: 0,
};

const BUCKETS = Object.keys(EMPTY) as readonly CardTypeBucket[];

/**
 * Maindeck cards per card type.
 *
 * **A multi-type card is counted under every type it has.** An Artifact Creature
 * adds to both `Artifact` and `Creature`, so these counts do **not** sum to the
 * deck size. The alternative — picking one "primary" type — needs an arbitrary
 * precedence order and makes "how many creatures does this deck run" wrong,
 * which is the question the number is actually for.
 *
 * Only the front side of a multi-face card is read: that is the side you cast,
 * and counting a modal land's back face as a Land would double-count the
 * manabase.
 */
export function typeCounts(deck: ResolvedDeck, index: CardIndex): TypeCounts {
  const counts: Record<CardTypeBucket, number> = { ...EMPTY };
  for (const { entry, card } of entriesOn(deck, index, "main")) {
    for (const bucket of bucketsFor(card)) counts[bucket] += entry.qty;
  }
  return counts;
}

function bucketsFor(card: OracleCard): readonly CardTypeBucket[] {
  const front = frontTypeLine(card);
  return BUCKETS.filter((bucket) => new RegExp(`\\b${bucket}s?\\b`, "i").test(front));
}

function frontTypeLine(card: OracleCard): string {
  const front = card.faces?.[0];
  if (front !== undefined) return front.typeLine;
  // A `//`-joined type line belongs to a split card; the first half is the front.
  return card.typeLine.split("//")[0] ?? card.typeLine;
}
