import { describe, expectTypeOf, it } from "vitest";
import type { OracleId } from "./cards";
import type {
  ArchetypeStats,
  CardStats,
  DeckMetrics,
  DeckVector,
  EventSeries,
  LayoutPoint,
  MatchupStats,
  MetricRarity,
  MvBucket,
  SimilarityEdge,
  StatsBoard,
  SuppressionVerdict,
  TypeCounts,
  WilsonInterval,
} from "./metrics";

/** True for the keys of `T` that may not be omitted. */
type RequiredKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? never : K;
}[keyof T];

const llanowarElves = "8f3c1a27-5e2d-4a91-bc44-6d0f7b2e91a3" as OracleId;
const bloomvineRegent = "b8c4b1de-4d2c-4a1f-9e44-1f3a0c6b7d21" as OracleId;
const feedTheSwarm = "3f0a1c7e-9b52-4a36-8d10-6c2b5e4f9a83" as OracleId;

const abzanMidrange = "a1f0c3d2-1b44-4f7e-9c58-2e6b0d4a7f11";
const fourColorDragons = "c7d2e9b4-6a31-4f08-85ad-9b1e3c70d642";
const seasonTwo = "5b1e7c90-2d34-4a6f-91cc-0e8a4f2b6d77";
const july2026 = "0c9a4d17-8e63-4b52-a70f-3d1f6c8b2e45";

/** An Abzan Midrange list: 24 lands, 36 spells, 15 in the sideboard. */
const abzanMetrics = {
  deckId: "9e2b7f14-3c60-42a8-b1d5-7f0e6a9c4b38",
  maindeckCount: 60,
  sideboardCount: 15,
  avgMvInclLands: 1.65,
  avgMvExclLands: 2.75,
  avgMvSideboard: 2.2,
  totalMv: 99,
  mvBuckets: { "1": 8, "2": 12, "3": 9, "4": 4, "5": 2, "6": 1, "7+": 0 },
  colorCounts: { W: 10, U: 0, B: 12, R: 0, G: 14, C: 4 },
  colorIdentity: ["W", "B", "G"],
  typeCounts: {
    Land: 24,
    Creature: 18,
    Instant: 6,
    Sorcery: 7,
    Artifact: 2,
    Enchantment: 3,
    Planeswalker: 0,
    Battle: 0,
  },
  // Attribution is by legal set: the `Llanowar Elves (M19)` copies land under FDN.
  // Keys are `SetCode`s — lowercase, as Scryfall emits them.
  setCounts: { fdn: 22, tdm: 11, eoe: 9, dft: 8, ecl: 6, sos: 4 },
  rarityCounts: { common: 21, uncommon: 14, rare: 19, mythic: 6 },
  unresolvedCards: 0,
  computedAt: "2026-08-02T11:04:00.000Z",
} satisfies DeckMetrics;

describe("metrics contracts", () => {
  it("matches the deck_metrics table column for column", () => {
    expectTypeOf(abzanMetrics).toExtend<DeckMetrics>();
    expectTypeOf<keyof DeckMetrics>().toEqualTypeOf<
      | "deckId"
      | "maindeckCount"
      | "sideboardCount"
      | "avgMvInclLands"
      | "avgMvExclLands"
      | "avgMvSideboard"
      | "totalMv"
      | "mvBuckets"
      | "colorCounts"
      | "colorIdentity"
      | "typeCounts"
      | "setCounts"
      | "rarityCounts"
      | "unresolvedCards"
      | "computedAt"
    >();
    // `not null` columns are required; the nullable numerics are present-and-null.
    expectTypeOf<RequiredKeys<DeckMetrics>>().toEqualTypeOf<
      keyof DeckMetrics
    >();
    expectTypeOf<DeckMetrics["avgMvSideboard"]>().toEqualTypeOf<
      number | null
    >();
    expectTypeOf<DeckMetrics["colorIdentity"]>().toEqualTypeOf<
      readonly ("W" | "U" | "B" | "R" | "G")[] | null
    >();
  });

  it("carries an empty deck without inventing zeroes for the average mana values", () => {
    const empty = {
      ...abzanMetrics,
      maindeckCount: 0,
      sideboardCount: 0,
      avgMvInclLands: null,
      avgMvExclLands: null,
      avgMvSideboard: null,
      totalMv: null,
      colorIdentity: null,
      unresolvedCards: 1,
    } satisfies DeckMetrics;
    expectTypeOf(empty).toExtend<DeckMetrics>();
  });

  it("buckets mana value 1-6 and 7+, and nothing else", () => {
    expectTypeOf<MvBucket>().toEqualTypeOf<
      "1" | "2" | "3" | "4" | "5" | "6" | "7+"
    >();
    // Lands are excluded from the curve, so the buckets sum to the 36 spells, not to 60.
    const spells = Object.values(abzanMetrics.mvBuckets).reduce(
      (a, b) => a + b,
      0,
    );
    expectTypeOf(spells).toBeNumber();
    expectTypeOf<"0">().not.toExtend<MvBucket>();
    expectTypeOf<"7">().not.toExtend<MvBucket>();
  });

  it("counts colours of identity plus a colourless bucket", () => {
    expectTypeOf<keyof DeckMetrics["colorCounts"]>().toEqualTypeOf<
      "W" | "U" | "B" | "R" | "G" | "C"
    >();
  });

  it("counts the eight card types", () => {
    expectTypeOf<keyof TypeCounts>().toEqualTypeOf<
      | "Land"
      | "Creature"
      | "Instant"
      | "Sorcery"
      | "Artifact"
      | "Enchantment"
      | "Planeswalker"
      | "Battle"
    >();
  });

  it("keys set counts by the legal set, not the printed one", () => {
    // `3 Llanowar Elves (FDN) 227` and a copy printed in M19 both count as FDN (E6.4).
    const byLegalSet = { fdn: 3, tdm: 4 } satisfies DeckMetrics["setCounts"];
    expectTypeOf(byLegalSet).toExtend<DeckMetrics["setCounts"]>();
    // A set outside the Season II pool is still a legal key: the pool is data, not code.
    const seasonOne = { dsk: 4 } satisfies DeckMetrics["setCounts"];
    expectTypeOf(seasonOne).toExtend<DeckMetrics["setCounts"]>();
  });

  it("counts rarity as C/U/R/MR from the printing in the legal pool", () => {
    expectTypeOf<MetricRarity>().toEqualTypeOf<
      "common" | "uncommon" | "rare" | "mythic"
    >();
    expectTypeOf<"special">().not.toExtend<MetricRarity>();
    expectTypeOf<"bonus">().not.toExtend<MetricRarity>();
  });

  it("describes a card_stats row keyed by season, oracle id and board", () => {
    const stockUp = {
      seasonId: seasonTwo,
      oracleId: bloomvineRegent,
      board: "main",
      decksIncluding: 31,
      totalCopies: 108,
      avgCopies: 3.48,
      inclusionRate: 0.316,
      primaryArchetypeId: fourColorDragons,
      archetypeBreakdown: [
        { archetypeId: fourColorDragons, decks: 19, share: 0.613 },
        { archetypeId: abzanMidrange, decks: 4, share: 0.129 },
      ],
      gameWins: 74,
      gameLosses: 61,
      winRate: 0.548,
      byEvent: [
        {
          tournamentId: july2026,
          eventDate: "2026-08-01",
          stats: {
            decksIncluding: 12,
            deckCount: 98,
            totalCopies: 41,
            inclusionRate: 0.122,
          },
        },
      ],
    } satisfies CardStats;
    expectTypeOf(stockUp).toExtend<CardStats>();
    expectTypeOf<CardStats["oracleId"]>().toEqualTypeOf<OracleId>();
    expectTypeOf<CardStats["primaryArchetypeId"]>().toEqualTypeOf<
      string | null
    >();
  });

  it("has no commander board on card_stats", () => {
    expectTypeOf<StatsBoard>().toEqualTypeOf<"main" | "side">();
    expectTypeOf<"command">().not.toExtend<StatsBoard>();
  });

  it("leaves a card win rate null when nobody has played the card", () => {
    // Whatever the number, it is "win rate of decks including this card" (§24) and is
    // suppressed under 20 games — charts read it through suppress-small-n, not directly.
    expectTypeOf<CardStats["winRate"]>().toEqualTypeOf<number | null>();
    const unplayed = {
      seasonId: seasonTwo,
      oracleId: feedTheSwarm,
      board: "side",
      decksIncluding: 0,
      totalCopies: 0,
      avgCopies: 0,
      inclusionRate: 0,
      primaryArchetypeId: null,
      archetypeBreakdown: [],
      gameWins: 0,
      gameLosses: 0,
      winRate: null,
      byEvent: [],
    } satisfies CardStats;
    expectTypeOf(unplayed).toExtend<CardStats>();
  });

  it("describes an archetype_stats row with its Wilson bounds", () => {
    const dragons = {
      seasonId: seasonTwo,
      archetypeId: fourColorDragons,
      deckCount: 14,
      shareOfSupertype: 0.28,
      shareOfField: 0.143,
      roundWins: 41,
      roundLosses: 33,
      roundDraws: 2,
      gameWins: 92,
      gameLosses: 78,
      gameWinRate: 0.541,
      roundWinRate: 0.554,
      wilsonLow: 0.442,
      wilsonHigh: 0.661,
      byEvent: [
        {
          tournamentId: july2026,
          eventDate: "2026-08-01",
          stats: {
            deckCount: 6,
            shareOfField: 0.061,
            roundWins: 18,
            roundLosses: 14,
            roundDraws: 1,
            gameWins: 40,
            gameLosses: 34,
          },
        },
      ],
    } satisfies ArchetypeStats;
    expectTypeOf(dragons).toExtend<ArchetypeStats>();
    expectTypeOf<ArchetypeStats["wilsonLow"]>().toEqualTypeOf<number | null>();
    expectTypeOf<ArchetypeStats["wilsonHigh"]>().toEqualTypeOf<number | null>();
  });

  it("shares one by-event envelope between card and archetype series", () => {
    type CardPoint = CardStats["byEvent"][number];
    type ArchetypePoint = ArchetypeStats["byEvent"][number];
    expectTypeOf<Omit<CardPoint, "stats">>().toEqualTypeOf<
      Omit<ArchetypePoint, "stats">
    >();
    expectTypeOf<CardStats["byEvent"]>().toExtend<
      EventSeries<CardPoint["stats"]>
    >();
  });

  it("orders the deck pair on a similarity edge", () => {
    // deck_similarity has `check (deck_a < deck_b)`: one row per pair, undirected graph.
    const edge = {
      seasonId: seasonTwo,
      deckA: "1a4c7e20-9b33-4d81-8f05-6c2e0b7a3d19",
      deckB: "9e2b7f14-3c60-42a8-b1d5-7f0e6a9c4b38",
      similarity: 0.87,
      sharedCards: 63,
    } satisfies SimilarityEdge;
    expectTypeOf(edge).toExtend<SimilarityEdge>();
    expectTypeOf(edge.deckA < edge.deckB).toBeBoolean();
  });

  it("maps a deck to card quantities with basics excluded", () => {
    // 9 Forest (EOE) 266 does not appear: basics are dropped before the vector is built.
    const vector: DeckVector = new Map([
      [llanowarElves, 3],
      [bloomvineRegent, 4],
      [feedTheSwarm, 2],
    ]);
    expectTypeOf(vector).toEqualTypeOf<ReadonlyMap<OracleId, number>>();
    expectTypeOf(vector.get(llanowarElves)).toEqualTypeOf<number | undefined>();
  });

  it("places a deck on the map at a versioned layout", () => {
    const point = {
      seasonId: seasonTwo,
      deckId: "9e2b7f14-3c60-42a8-b1d5-7f0e6a9c4b38",
      x: -318.42,
      y: 204.07,
      layoutVersion: 1,
    } satisfies LayoutPoint;
    expectTypeOf(point).toExtend<LayoutPoint>();
  });

  it("reports a matchup from A's side with the pair ordered", () => {
    const matchup = {
      seasonId: seasonTwo,
      archetypeA: abzanMidrange,
      archetypeB: fourColorDragons,
      matches: 11,
      aMatchWins: 6,
      bMatchWins: 4,
      matchDraws: 1,
      aGameWins: 14,
      bGameWins: 12,
      aWinRate: 0.545,
      wilsonLow: 0.28,
      wilsonHigh: 0.787,
      // archetypeA < archetypeB, so the mirror row never exists.
    } satisfies MatchupStats;
    expectTypeOf(matchup).toExtend<MatchupStats>();
    expectTypeOf(matchup.archetypeA < matchup.archetypeB).toBeBoolean();
  });

  it("returns a Wilson interval that carries its sample size", () => {
    const interval = {
      point: 0.554,
      low: 0.442,
      high: 0.661,
      n: 74,
    } satisfies WilsonInterval;
    expectTypeOf(interval).toExtend<WilsonInterval>();
    expectTypeOf<WilsonInterval["n"]>().toEqualTypeOf<number>();
  });

  it("cannot express a rate without its n, and hides one without a rate at all", () => {
    const shown = {
      level: "show",
      rate: 0.554,
      n: 74,
      interval: { point: 0.554, low: 0.442, high: 0.661, n: 74 },
    } satisfies SuppressionVerdict;
    const thin = {
      level: "grey",
      rate: 0.6,
      n: 5,
      interval: { point: 0.6, low: 0.231, high: 0.882, n: 5 },
    } satisfies SuppressionVerdict;
    // Under the floor — an archetype with two decks, or a card under 20 games.
    const hidden = { level: "hide", n: 2 } satisfies SuppressionVerdict;
    expectTypeOf(shown).toExtend<SuppressionVerdict>();
    expectTypeOf(thin).toExtend<SuppressionVerdict>();
    expectTypeOf(hidden).toExtend<SuppressionVerdict>();

    // `n` reads off the union, so every arm has it.
    expectTypeOf<SuppressionVerdict["n"]>().toEqualTypeOf<number>();
    expectTypeOf<
      Extract<SuppressionVerdict, { level: "hide" }>
    >().not.toHaveProperty("rate");
    expectTypeOf<
      Extract<SuppressionVerdict, { level: "show" }>
    >().toHaveProperty("interval");
  });
});
