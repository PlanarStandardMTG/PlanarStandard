import type {
  CardFace,
  CardImageUris,
  CardPrinting,
  Color,
  Layout,
  OracleCard,
  OracleId,
  Rarity,
  SetCode,
} from "@ps/contracts";

/**
 * Which layouts survive the prune.
 *
 * `satisfies Record<Layout, boolean>` is the point of the object form: tsc fails here
 * if the contract's `Layout` union gains a member this list lacks, or if this list
 * names one the union dropped. The two cannot drift.
 *
 * `reversible_card` is false because those rows carry no top-level `oracle_id`, no
 * `cmc` and no `type_line` — they cannot produce a valid printing. `finish()` asserts
 * each dropped row's oracle is still reachable some other way.
 */
const EMITTED_LAYOUTS = {
  normal: true,
  split: true,
  flip: true,
  transform: true,
  modal_dfc: true,
  meld: true,
  leveler: true,
  class: true,
  case: true,
  saga: true,
  adventure: true,
  prepare: true,
  mutate: true,
  prototype: true,
  battle: true,
  reversible_card: false,
} as const satisfies Record<Layout, boolean>;

const RARITIES = {
  common: true,
  uncommon: true,
  rare: true,
  mythic: true,
  special: true,
  bonus: true,
} as const satisfies Record<Rarity, true>;

export type PruneStats = {
  readonly seen: number;
  readonly kept: number;
  readonly outOfScope: number;
  /** `reversible_card` and anything else with no usable oracle id. */
  readonly droppedUnkeyed: number;
  readonly droppedLayout: number;
  readonly droppedMalformed: number;
};

export type PruneResult = {
  readonly oracle: readonly OracleCard[];
  readonly printings: readonly CardPrinting[];
  readonly printingCountBySet: Readonly<Record<SetCode, number>>;
  readonly stats: PruneStats;
  /**
   * Oracle ids that only ever appeared on a dropped row. Empty in every set so far;
   * non-empty means the pool gained a card reachable *only* through a layout we skip,
   * and the build must fail rather than ship a dataset missing a legal card.
   */
  readonly unreachableOracleIds: readonly OracleId[];
};

export type Pruner = {
  /** One parsed JSONL line. Never throws on a bad row — it counts it and moves on. */
  accept(raw: unknown): void;
  finish(): PruneResult;
};

/**
 * Fold the bulk file down to the committed dataset, one row at a time.
 *
 * Holds only the surviving rows, so peak memory tracks the pool (a couple of thousand
 * cards), not the 75 MB the stream is feeding it.
 */
export function createPruner(scope: readonly SetCode[]): Pruner {
  const wanted = new Set(scope.map((code) => code.toLowerCase()));
  const oracle = new Map<OracleId, { card: OracleCard; setCodes: Set<SetCode> }>();
  const printings: CardPrinting[] = [];
  const dropped = new Set<OracleId>();
  let seen = 0;
  let outOfScope = 0;
  let droppedUnkeyed = 0;
  let droppedLayout = 0;
  let droppedMalformed = 0;

  function accept(raw: unknown): void {
    if (!isRecord(raw)) return;
    seen += 1;

    const setCode = asString(raw["set"])?.toLowerCase();
    if (setCode === undefined || !wanted.has(setCode)) {
      outOfScope += 1;
      return;
    }

    const layout = asString(raw["layout"]);
    if (layout === undefined || !(layout in EMITTED_LAYOUTS)) {
      droppedLayout += 1;
      return;
    }
    if (!EMITTED_LAYOUTS[layout as keyof typeof EMITTED_LAYOUTS]) {
      droppedUnkeyed += 1;
      for (const id of faceOracleIds(raw)) dropped.add(id);
      return;
    }

    const oracleId = asString(raw["oracle_id"]) as OracleId | undefined;
    if (oracleId === undefined) {
      droppedUnkeyed += 1;
      for (const id of faceOracleIds(raw)) dropped.add(id);
      return;
    }

    const printing = toPrinting(raw, oracleId, setCode);
    const card = toOracleCard(raw, oracleId, layout as Layout);
    if (printing === null || card === null) {
      droppedMalformed += 1;
      return;
    }

    printings.push(printing);

    // A card legal through two sets arrives twice; the union of its sets is what
    // legality reads (ADR 007), so merge rather than overwrite.
    const existing = oracle.get(oracleId);
    if (existing === undefined) oracle.set(oracleId, { card, setCodes: new Set([setCode]) });
    else existing.setCodes.add(setCode);
  }

  function finish(): PruneResult {
    const cards = [...oracle.values()]
      .map(({ card, setCodes }): OracleCard => ({
        ...card,
        setCodes: [...setCodes].sort(),
      }))
      .sort((a, b) => a.oracleId.localeCompare(b.oracleId));

    const sortedPrintings = [...printings].sort(
      (a, b) =>
        a.setCode.localeCompare(b.setCode) ||
        a.collectorNumber.localeCompare(b.collectorNumber, "en", {
          numeric: true,
        }),
    );

    const printingCountBySet: Record<SetCode, number> = {};
    for (const printing of sortedPrintings) {
      printingCountBySet[printing.setCode] = (printingCountBySet[printing.setCode] ?? 0) + 1;
    }

    const unreachableOracleIds = [...dropped].filter((id) => !oracle.has(id)).sort();

    return {
      oracle: cards,
      printings: sortedPrintings,
      printingCountBySet,
      stats: {
        seen,
        kept: sortedPrintings.length,
        outOfScope,
        droppedUnkeyed,
        droppedLayout,
        droppedMalformed,
      },
      unreachableOracleIds,
    };
  }

  return { accept, finish };
}

function toPrinting(
  raw: Record<string, unknown>,
  oracleId: OracleId,
  setCode: SetCode,
): CardPrinting | null {
  const collectorNumber = asString(raw["collector_number"]);
  const rarity = asString(raw["rarity"]);
  if (collectorNumber === undefined || rarity === undefined || !(rarity in RARITIES)) return null;

  const imageUris = toImageUris(raw["image_uris"]);
  const faceImages = asArray(raw["card_faces"])
    ?.map((face) => (isRecord(face) ? toImageUris(face["image_uris"]) : null))
    .filter((uris): uris is CardImageUris => uris !== null);

  const base = {
    oracleId,
    setCode,
    collectorNumber,
    rarity: rarity as Rarity,
    imageUris,
    promo: raw["promo"] === true,
    digital: raw["digital"] === true,
  };

  // `exactOptionalPropertyTypes` — the key is absent, never set to undefined.
  return faceImages !== undefined && faceImages.length > 0 && imageUris === null
    ? { ...base, faceImageUris: faceImages }
    : base;
}

function toOracleCard(
  raw: Record<string, unknown>,
  oracleId: OracleId,
  layout: Layout,
): OracleCard | null {
  const name = asString(raw["name"]);
  const typeLine = asString(raw["type_line"]);
  const manaValue = raw["cmc"];
  if (name === undefined || typeLine === undefined || typeof manaValue !== "number") return null;

  const faces = asArray(raw["card_faces"])
    ?.map(toFace)
    .filter((face): face is CardFace => face !== null);

  const base: OracleCard = {
    oracleId,
    name,
    // "" on lands and on layouts that cost each face separately; both mean "no cost".
    manaCost: asNonEmptyString(raw["mana_cost"]) ?? null,
    manaValue,
    colorIdentity: asArray(raw["color_identity"])?.filter(isColor) ?? [],
    typeLine,
    oracleText: asNonEmptyString(raw["oracle_text"]) ?? null,
    layout,
    setCodes: [],
  };

  return faces !== undefined && faces.length > 0 ? { ...base, faces } : base;
}

function toFace(raw: unknown): CardFace | null {
  if (!isRecord(raw)) return null;
  const name = asString(raw["name"]);
  const typeLine = asString(raw["type_line"]);
  if (name === undefined || typeLine === undefined) return null;

  return {
    name,
    manaCost: asNonEmptyString(raw["mana_cost"]) ?? null,
    // Scryfall omits `cmc` on most face objects; the contract allows null for that.
    manaValue: typeof raw["cmc"] === "number" ? raw["cmc"] : null,
    typeLine,
    oracleText: asNonEmptyString(raw["oracle_text"]) ?? null,
  };
}

function toImageUris(raw: unknown): CardImageUris | null {
  if (!isRecord(raw)) return null;
  const small = asString(raw["small"]);
  const normal = asString(raw["normal"]);
  const artCrop = asString(raw["art_crop"]);
  return small !== undefined && normal !== undefined && artCrop !== undefined
    ? { small, normal, artCrop }
    : null;
}

/** Reversible rows key their oracle on each face instead of the row. */
function faceOracleIds(raw: Record<string, unknown>): readonly OracleId[] {
  return (
    asArray(raw["card_faces"])
      ?.flatMap((face) => (isRecord(face) ? [asString(face["oracle_id"])] : []))
      .filter((id): id is string => id !== undefined)
      .map((id) => id as OracleId) ?? []
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): readonly unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function isColor(value: unknown): value is Color {
  return value === "W" || value === "U" || value === "B" || value === "R" || value === "G";
}
