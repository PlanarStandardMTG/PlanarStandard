import type {
  CardIndex,
  FormatRules,
  MetricRarity,
  RarityCounts,
  ResolvedDeck,
} from "@ps/contracts";

import { normalizeSetCode } from "../../legality/build-card-index/index";
import { entriesOn } from "../shared";

const EMPTY: RarityCounts = { common: 0, uncommon: 0, rare: 0, mythic: 0 };

const ORDER: readonly MetricRarity[] = ["common", "uncommon", "rare", "mythic"];

/**
 * Maindeck cards by rarity, read off the printing **inside the legal pool**.
 *
 * A card's rarity is a property of a printing, not of the card, and the same
 * card can be uncommon in one set and rare in another. The pool printing is the
 * one that matters: a player's promo or Secret Lair copy says nothing about how
 * available the card is in the format.
 *
 * A card with pool printings at two rarities takes the **lowest**, which is the
 * one that governs how easily the card is obtained.
 */
export function rarityCounts(
  deck: ResolvedDeck,
  index: CardIndex,
  rules: FormatRules,
): RarityCounts {
  const counts: Record<MetricRarity, number> = { ...EMPTY };

  for (const { entry } of entriesOn(deck, index, "main")) {
    const oracleId = entry.oracleId;
    if (oracleId === null) continue;
    const rarity = poolRarity(index, rules, oracleId);
    if (rarity === null) continue;
    counts[rarity] += entry.qty;
  }

  return counts;
}

function poolRarity(
  index: CardIndex,
  rules: FormatRules,
  oracleId: NonNullable<ResolvedDeck["cards"][number]["oracleId"]>,
): MetricRarity | null {
  const printings = index.byOracleId.get(oracleId)?.printings ?? [];
  let best: MetricRarity | null = null;

  for (const printing of printings) {
    if (!rules.legalSets.has(normalizeSetCode(printing.setCode))) continue;
    const rarity = ORDER.find((candidate) => candidate === printing.rarity);
    if (rarity === undefined) continue;
    if (best === null || ORDER.indexOf(rarity) < ORDER.indexOf(best)) best = rarity;
  }

  return best;
}
