import type {
  CardDataset,
  CardIndex,
  CardIndexEntry,
  CardPrinting,
  OracleCard,
  OracleId,
  SetCode,
} from "@ps/contracts";

import { normalizeFaces, normalizeName } from "../../decklist/normalize-name/index";

/**
 * The loaded dataset, turned into the three maps every lookup needs.
 *
 * Pure: it takes the parsed dataset as an argument. Loading `data/cards/` is a
 * `jobs`/`web` concern, because `core` does no file I/O (§8, E4.7).
 */
export function buildCardIndex(dataset: CardDataset): CardIndex {
  const printingsByOracle = new Map<OracleId, CardPrinting[]>();
  for (const printing of dataset.printings) {
    const existing = printingsByOracle.get(printing.oracleId);
    if (existing === undefined) printingsByOracle.set(printing.oracleId, [printing]);
    else existing.push(printing);
  }

  const byOracleId = new Map<OracleId, CardIndexEntry>();
  const byNormalizedName = new Map<string, OracleId[]>();
  const bySet = new Map<SetCode, OracleId[]>();

  for (const card of dataset.oracle) {
    byOracleId.set(card.oracleId, {
      card,
      printings: printingsByOracle.get(card.oracleId) ?? [],
    });

    for (const key of nameKeys(card)) {
      const bucket = byNormalizedName.get(key);
      if (bucket === undefined) byNormalizedName.set(key, [card.oracleId]);
      else if (!bucket.includes(card.oracleId)) bucket.push(card.oracleId);
    }

    for (const setCode of card.setCodes) {
      const key = normalizeSetCode(setCode);
      const bucket = bySet.get(key);
      if (bucket === undefined) bySet.set(key, [card.oracleId]);
      else if (!bucket.includes(card.oracleId)) bucket.push(card.oracleId);
    }
  }

  return { byOracleId, byNormalizedName, bySet };
}

/**
 * Set codes are compared lower-case throughout. Scryfall emits them lower,
 * decklists write `(TDM)`, and the corpus contains `(fdn)` too — so the index
 * keys one way and every lookup goes through this.
 */
export function normalizeSetCode(setCode: SetCode): SetCode {
  return setCode.toLowerCase();
}

/**
 * The whole name, plus each face on its own.
 *
 * A decklist may write either `Marang River Regent / Coil and Catch` or just
 * `Marang River Regent`, and both have to reach the same card. A face name can
 * collide with another card's whole name, which is why the map holds a list.
 */
function nameKeys(card: OracleCard): readonly string[] {
  const whole = normalizeName(card.name);
  const faces = normalizeFaces(card.name);
  const keys = new Set<string>([whole, ...faces]);
  for (const face of card.faces ?? []) keys.add(normalizeName(face.name));
  keys.delete("");
  return [...keys];
}
