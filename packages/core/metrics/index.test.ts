import type {
  CardDataset,
  CardPrinting,
  FormatVersionId,
  IsoDateTime,
  OracleCard,
  OracleId,
  Rarity,
  ResolvedCard,
  ResolvedDeck,
  SetCode,
} from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { buildCardIndex } from "../legality/build-card-index/index";
import { resolveFormat } from "../legality/resolve-format/index";
import { averageMv } from "./average-mv/index";
import { colorCounts, colorIdentity } from "./color-counts/index";
import { computeDeckMetrics } from "./compute-deck-metrics/index";
import { bucketFor, manaCurve } from "./mana-curve/index";
import { rarityCounts } from "./rarity-counts/index";
import { attributeCard, setAttribution } from "./set-attribution/index";
import { typeCounts } from "./type-counts/index";

/**
 * A dataset built so every metric's expected value is known by construction.
 * The real-data golden test is E22.8, which needs the community spreadsheet.
 */
interface Spec {
  readonly name: string;
  readonly mv: number;
  readonly colors: readonly ("W" | "U" | "B" | "R" | "G")[];
  readonly typeLine: string;
  readonly sets: readonly SetCode[];
  readonly rarities?: ReadonlyArray<readonly [SetCode, Rarity]>;
}

const SPECS: readonly Spec[] = [
  {
    name: "Voice of Victory",
    mv: 2,
    colors: ["W"],
    typeLine: "Creature — Human Soldier",
    sets: ["sos"],
    rarities: [["sos", "rare"]],
  },
  {
    name: "Stock Up",
    mv: 3,
    colors: ["U"],
    typeLine: "Instant",
    sets: ["dft"],
    rarities: [["dft", "uncommon"]],
  },
  {
    name: "Ride's End",
    mv: 2,
    colors: ["W"],
    typeLine: "Instant",
    sets: ["dft"],
    rarities: [["dft", "common"]],
  },
  {
    name: "Ugin, Eye of the Storms",
    mv: 7,
    colors: [],
    typeLine: "Legendary Planeswalker — Ugin",
    sets: ["tdm"],
    rarities: [["tdm", "mythic"]],
  },
  {
    name: "Mazemind Tome",
    mv: 2,
    colors: [],
    typeLine: "Artifact",
    sets: ["fdn"],
    rarities: [["fdn", "rare"]],
  },
  {
    name: "Gene Pollinator",
    mv: 4,
    colors: ["G", "B"],
    typeLine: "Artifact Creature — Insect",
    sets: ["eoe"],
    rarities: [["eoe", "uncommon"]],
  },
  {
    name: "Tranquil Cove",
    mv: 0,
    colors: ["W", "U"],
    typeLine: "Land",
    sets: ["tdm"],
    rarities: [["tdm", "common"]],
  },
  {
    name: "Island",
    mv: 0,
    colors: ["U"],
    typeLine: "Basic Land — Island",
    sets: ["eoe"],
    rarities: [["eoe", "common"]],
  },
  // Legal through two sets: the tiebreak case.
  {
    name: "Llanowar Elves",
    mv: 1,
    colors: ["G"],
    typeLine: "Creature — Elf Druid",
    sets: ["fdn", "tdm"],
    rarities: [
      ["fdn", "common"],
      ["tdm", "uncommon"],
    ],
  },
  // A modal card: front face is what gets cast.
  {
    name: "Marang River Regent / Coil and Catch",
    mv: 6,
    colors: ["U"],
    typeLine: "Creature — Dragon // Instant",
    sets: ["tdm"],
    rarities: [["tdm", "rare"]],
  },
];

const oracleId = (name: string): OracleId => `oracle:${name}` as OracleId;

const DATASET: CardDataset = {
  oracle: SPECS.map((spec): OracleCard => ({
    oracleId: oracleId(spec.name),
    name: spec.name,
    manaCost: null,
    manaValue: spec.mv,
    colorIdentity: spec.colors,
    typeLine: spec.typeLine,
    oracleText: null,
    layout: spec.name.includes(" / ") ? "split" : "normal",
    setCodes: spec.sets,
  })),
  printings: SPECS.flatMap((spec): CardPrinting[] =>
    (spec.rarities ?? []).map(([setCode, rarity]) => ({
      oracleId: oracleId(spec.name),
      setCode,
      collectorNumber: "1",
      rarity,
      imageUris: null,
      promo: false,
      digital: false,
    })),
  ),
  meta: {
    bulkUpdatedAt: "2026-08-01T00:00:00Z",
    setCodes: ["sos", "ecl", "eoe", "tdm", "dft", "fdn"],
    oracleCardCount: SPECS.length,
    printingCount: 0,
    printingCountBySet: {},
    generatedAt: "2026-08-01T00:00:00Z",
    attribution: { source: "Scryfall", sourceUrl: "https://scryfall.com", notice: "" },
  },
};

const INDEX = buildCardIndex(DATASET);

/** Declared order matters: set-attribution's tiebreak follows it. */
const RULES = resolveFormat({
  formatVersionId: "season-ii" as FormatVersionId,
  legalSets: ["sos", "ecl", "eoe", "tdm", "dft", "fdn"],
  cardRules: [],
});

function deckOf(
  main: ReadonlyArray<readonly [string, number]>,
  side: ReadonlyArray<readonly [string, number]> = [],
  unresolved: ReadonlyArray<readonly [string, number]> = [],
): ResolvedDeck {
  const build = (
    pairs: ReadonlyArray<readonly [string, number]>,
    board: ResolvedCard["board"],
    resolved: boolean,
  ): ResolvedCard[] =>
    pairs.map(([name, qty], i) => ({
      qty,
      name,
      oracleId: resolved ? oracleId(name) : null,
      foil: false,
      board,
      lineNumber: i + 1,
    }));

  const cards = [
    ...build(main, "main", true),
    ...build(side, "side", true),
    ...build(unresolved, "main", false),
  ];
  return { cards, issues: [], hasUnresolvedCards: unresolved.length > 0 };
}

describe("core/metrics/mana-curve", () => {
  it("buckets non-lands by mana value", () => {
    const curve = manaCurve(
      deckOf([
        ["Llanowar Elves", 4],
        ["Stock Up", 3],
        ["Ugin, Eye of the Storms", 2],
      ]),
      INDEX,
    );
    expect(curve).toEqual({ "1": 4, "2": 0, "3": 3, "4": 0, "5": 0, "6": 0, "7+": 2 });
  });

  it("excludes lands, basic and non-basic alike", () => {
    const curve = manaCurve(
      deckOf([
        ["Island", 7],
        ["Tranquil Cove", 4],
      ]),
      INDEX,
    );
    expect(Object.values(curve).every((n) => n === 0)).toBe(true);
  });

  it("collapses everything from 7 upward into 7+", () => {
    expect(bucketFor(7)).toBe("7+");
    expect(bucketFor(12)).toBe("7+");
    expect(bucketFor(6)).toBe("6");
  });

  it("puts a zero-cost non-land in bucket 1, as the plan's bucket list forces", () => {
    expect(bucketFor(0)).toBe("1");
  });

  it("counts copies, not lines", () => {
    expect(manaCurve(deckOf([["Stock Up", 4]]), INDEX)["3"]).toBe(4);
  });
});

describe("core/metrics/color-counts", () => {
  it("counts a card once in each colour of its identity", () => {
    const counts = colorCounts(deckOf([["Gene Pollinator", 4]]), INDEX);
    expect(counts.G).toBe(4);
    expect(counts.B).toBe(4);
    expect(counts.W).toBe(0);
  });

  it("puts colourless cards under C rather than inventing a sixth colour", () => {
    const counts = colorCounts(deckOf([["Mazemind Tome", 3]]), INDEX);
    expect(counts.C).toBe(3);
  });

  it("does not sum to the deck size, because multicolour cards count twice", () => {
    const counts = colorCounts(deckOf([["Gene Pollinator", 4]]), INDEX);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(8);
  });

  it("derives the deck's colour identity in WUBRG order", () => {
    expect(
      colorIdentity(
        deckOf([
          ["Gene Pollinator", 4],
          ["Stock Up", 4],
          ["Mazemind Tome", 2],
        ]),
        INDEX,
      ),
    ).toEqual(["U", "B", "G"]);
  });
});

describe("core/metrics/type-counts", () => {
  it("counts a multi-type card under every type it has", () => {
    const counts = typeCounts(deckOf([["Gene Pollinator", 4]]), INDEX);
    expect(counts.Artifact).toBe(4);
    expect(counts.Creature).toBe(4);
  });

  it("reads only the front face of a split card", () => {
    const counts = typeCounts(deckOf([["Marang River Regent / Coil and Catch", 4]]), INDEX);
    expect(counts.Creature).toBe(4);
    expect(counts.Instant).toBe(0);
  });

  it("counts basic and non-basic lands alike as Land", () => {
    const counts = typeCounts(
      deckOf([
        ["Island", 7],
        ["Tranquil Cove", 4],
      ]),
      INDEX,
    );
    expect(counts.Land).toBe(11);
  });

  it("counts a planeswalker", () => {
    expect(typeCounts(deckOf([["Ugin, Eye of the Storms", 2]]), INDEX).Planeswalker).toBe(2);
  });
});

describe("core/metrics/set-attribution", () => {
  it("attributes a card to the legal set it is available through", () => {
    expect(setAttribution(deckOf([["Stock Up", 4]]), INDEX, RULES)).toEqual({ dft: 4 });
  });

  it("resolves a card legal through two sets by the declared order", () => {
    // Llanowar Elves is in both FDN and TDM; TDM comes first in the pool order.
    expect(attributeCard(oracleId("Llanowar Elves"), INDEX, RULES)).toBe("tdm");

    const reordered = resolveFormat({
      formatVersionId: "reordered" as FormatVersionId,
      legalSets: ["fdn", "tdm", "eoe", "dft", "ecl", "sos"],
      cardRules: [],
    });
    expect(attributeCard(oracleId("Llanowar Elves"), INDEX, reordered)).toBe("fdn");
  });

  it("is deterministic across runs", () => {
    const deck = deckOf([
      ["Llanowar Elves", 4],
      ["Stock Up", 4],
      ["Voice of Victory", 4],
    ]);
    expect(setAttribution(deck, INDEX, RULES)).toEqual(setAttribution(deck, INDEX, RULES));
  });

  it("omits a card no legal set carries", () => {
    const narrowed = resolveFormat({
      formatVersionId: "narrow" as FormatVersionId,
      legalSets: ["eoe"],
      cardRules: [],
    });
    expect(setAttribution(deckOf([["Stock Up", 4]]), INDEX, narrowed)).toEqual({});
  });
});

describe("core/metrics/rarity-counts", () => {
  it("counts by the rarity of the printing inside the pool", () => {
    const counts = rarityCounts(
      deckOf([
        ["Stock Up", 4],
        ["Ugin, Eye of the Storms", 1],
        ["Ride's End", 3],
      ]),
      INDEX,
      RULES,
    );
    expect(counts).toEqual({ common: 3, uncommon: 4, rare: 0, mythic: 1 });
  });

  it("takes the lowest rarity when the pool holds two printings", () => {
    // Llanowar Elves is common in FDN and uncommon in TDM.
    expect(rarityCounts(deckOf([["Llanowar Elves", 4]]), INDEX, RULES).common).toBe(4);
  });

  it("ignores a printing outside the pool", () => {
    const narrowed = resolveFormat({
      formatVersionId: "narrow" as FormatVersionId,
      legalSets: ["tdm"],
      cardRules: [],
    });
    // Only the TDM printing counts now, which is uncommon.
    expect(rarityCounts(deckOf([["Llanowar Elves", 4]]), INDEX, narrowed).uncommon).toBe(4);
  });
});

describe("core/metrics/average-mv", () => {
  it("computes the three averages, copy-weighted", () => {
    const deck = deckOf(
      [
        ["Stock Up", 4],
        ["Llanowar Elves", 4],
        ["Island", 2],
      ],
      [["Ride's End", 2]],
    );
    const averages = averageMv(deck, INDEX);
    // main: 4x3 + 4x1 + 2x0 = 16 over 10 cards
    expect(averages.inclLands).toBeCloseTo(1.6, 12);
    // non-lands: 16 over 8
    expect(averages.exclLands).toBeCloseTo(2, 12);
    expect(averages.sideboard).toBeCloseTo(2, 12);
    expect(averages.totalMv).toBe(16);
  });

  it("returns null rather than zero for an empty board", () => {
    const averages = averageMv(deckOf([["Stock Up", 4]]), INDEX);
    expect(averages.sideboard).toBeNull();
    expect(averageMv(deckOf([]), INDEX)).toEqual({
      inclLands: null,
      exclLands: null,
      sideboard: null,
      totalMv: null,
    });
  });

  it("returns null for excl-lands when the deck is all lands", () => {
    expect(averageMv(deckOf([["Island", 20]]), INDEX).exclLands).toBeNull();
  });
});

describe("core/metrics/compute-deck-metrics", () => {
  const computedAt = "2026-08-01T12:00:00Z" as IsoDateTime;

  it("fills every deck_metrics column", () => {
    const deck = deckOf(
      [
        ["Stock Up", 4],
        ["Llanowar Elves", 4],
        ["Gene Pollinator", 2],
        ["Island", 10],
      ],
      [["Ride's End", 3]],
    );
    const metrics = computeDeckMetrics("deck-1" as never, deck, INDEX, RULES, { computedAt });

    expect(metrics.maindeckCount).toBe(20);
    expect(metrics.sideboardCount).toBe(3);
    expect(metrics.mvBuckets["3"]).toBe(4);
    // Islands are blue: colour counts include lands, unlike the curve.
    expect(metrics.colorCounts.U).toBe(14);
    expect(metrics.typeCounts.Land).toBe(10);
    expect(metrics.setCounts).toEqual({ dft: 4, tdm: 4, eoe: 12 });
    expect(metrics.rarityCounts.common).toBe(14);
    expect(metrics.colorIdentity).toEqual(["U", "B", "G"]);
    expect(metrics.unresolvedCards).toBe(0);
    expect(metrics.computedAt).toBe(computedAt);
  });

  it("counts unresolved cards rather than hiding them", () => {
    const deck = deckOf([["Stock Up", 4]], [], [["Stokk Up", 3]]);
    const metrics = computeDeckMetrics("deck-2" as never, deck, INDEX, RULES, { computedAt });
    // The count is copies, because that is what excludes the deck from card_stats.
    expect(metrics.unresolvedCards).toBe(3);
    expect(metrics.maindeckCount).toBe(7);
    expect(metrics.mvBuckets["3"]).toBe(4);
  });

  it("takes its timestamp as an argument, because core has no clock", () => {
    const deck = deckOf([["Stock Up", 4]]);
    const a = computeDeckMetrics("d" as never, deck, INDEX, RULES, { computedAt });
    const b = computeDeckMetrics("d" as never, deck, INDEX, RULES, { computedAt });
    expect(b).toEqual(a);
  });
});
