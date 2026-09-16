import type {
  ArchetypeId,
  ArchetypeStats,
  CardStats,
  DeckId,
  DeckMetrics,
  MatchupStats,
  OracleId,
  SeasonId,
} from "@ps/contracts";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

import {
  getCardStats,
  getDeckMetrics,
  listArchetypeStats,
  listCardStats,
  listDeckMetrics,
  listLayoutPoints,
  listMatchupStats,
  listMatchupsForArchetype,
  listSimilarityEdges,
  replaceArchetypeStats,
  replaceCardStats,
  replaceLayout,
  replaceMatchupStats,
  replaceSimilarityEdges,
  upsertDeckMetrics,
} from "./index";

/**
 * Runs against a local Supabase with the seed loaded (`pnpm db:reset`).
 *
 * This suite makes **its own season** rather than writing into a seeded one.
 * Every write here replaces a season wholesale, which is the design — and a
 * design that would clear another suite's rows out from under it if the season
 * were shared.
 */
const url = process.env["SUPABASE_URL"] ?? "http://127.0.0.1:54321";
const anonKey =
  process.env["SUPABASE_ANON_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
/** Its own variable, never the production service-role name — see `repos/events`. */
const serviceKey =
  process.env["SUPABASE_LOCAL_SERVICE_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const reachable = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: anonKey },
  signal: AbortSignal.timeout(1500),
})
  .then((r) => r.ok)
  .catch(() => false);

const client = createClient(url, anonKey);
const service = createClient(url, serviceKey);

/** Seeded archetypes, and an ordered pair: the check constraint wants a < b. */
const AZORIUS = "33333333-3333-4333-8333-000000000001" as ArchetypeId;
const GOLGARI = "33333333-3333-4333-8333-000000000002" as ArchetypeId;
const ABZAN = "33333333-3333-4333-8333-000000000003" as ArchetypeId;

/** No `cards` table to point at — an oracle id here is a bare uuid (§14.1). */
const BOLT = "aaaaaaaa-1111-4111-8111-000000000001" as OracleId;
const COUNTERSPELL = "aaaaaaaa-1111-4111-8111-000000000002" as OracleId;

const run = Date.now();

async function makeSeason(): Promise<SeasonId> {
  const { data, error } = await service
    .from("seasons")
    // `ordinal` is unique and the seed holds the low numbers.
    .insert({ name: `vitest stats ${run}`, ordinal: 9000 + (run % 900), starts_on: "2025-01-01" })
    .select("id")
    .single();
  if (error !== null) throw new Error(`could not create a season: ${error.message}`);
  return (data as { id: string }).id as SeasonId;
}

async function makeDeck(name: string, visibility: "public" | "private"): Promise<DeckId> {
  const { data, error } = await service
    .from("decks")
    .insert({ name: `vitest-stats-${run}-${name}`, visibility })
    .select("id")
    .single();
  if (error !== null) throw new Error(`could not create a deck: ${error.message}`);
  return (data as { id: string }).id as DeckId;
}

const season = reachable ? await makeSeason() : ("" as SeasonId);
const publicDeck = reachable ? await makeDeck("public", "public") : ("" as DeckId);
const otherDeck = reachable ? await makeDeck("other", "public") : ("" as DeckId);
const privateDeck = reachable ? await makeDeck("private", "private") : ("" as DeckId);

/** Ordered, because `deck_a < deck_b` is a check constraint. */
const [deckA, deckB] = [publicDeck, otherDeck].sort() as [DeckId, DeckId];

const metricsFor = (deckId: DeckId, over: Partial<DeckMetrics> = {}): DeckMetrics => ({
  deckId,
  maindeckCount: 60,
  sideboardCount: 15,
  avgMvInclLands: 2.15,
  avgMvExclLands: 2.9,
  avgMvSideboard: 2.4,
  totalMv: 129,
  mvBuckets: { "1": 8, "2": 12, "3": 6, "4": 4, "5": 2, "6": 1, "7+": 0 },
  colorCounts: { W: 12, U: 14, B: 0, R: 0, G: 0, C: 4 },
  colorIdentity: ["W", "U"],
  typeCounts: {
    creature: 8,
    instant: 14,
    sorcery: 6,
    artifact: 2,
    enchantment: 3,
    planeswalker: 2,
    land: 25,
    battle: 0,
    other: 0,
  },
  setCounts: { FDN: 20, DSK: 18, BLB: 22 },
  rarityCounts: { common: 10, uncommon: 18, rare: 24, mythic: 8 },
  unresolvedCards: 0,
  computedAt: "2025-09-01T12:00:00Z",
  ...over,
});

const cardStat = (oracleId: OracleId, over: Partial<CardStats> = {}): CardStats => ({
  seasonId: season,
  oracleId,
  board: "main",
  decksIncluding: 40,
  totalCopies: 130,
  avgCopies: 3.25,
  inclusionRate: 0.4,
  primaryArchetypeId: AZORIUS,
  archetypeBreakdown: [{ archetypeId: AZORIUS, decks: 30, share: 0.75 }],
  gameWins: 120,
  gameLosses: 100,
  winRate: 0.545,
  byEvent: [
    {
      tournamentId: "55555555-5555-4555-8555-000000000001",
      eventDate: "2025-07-05",
      stats: { decksIncluding: 10, deckCount: 32, totalCopies: 34, inclusionRate: 0.3125 },
    },
  ],
  ...over,
});

const archetypeStat = (
  archetypeId: ArchetypeId,
  over: Partial<ArchetypeStats> = {},
): ArchetypeStats => ({
  seasonId: season,
  archetypeId,
  deckCount: 24,
  shareOfSupertype: 0.5,
  shareOfField: 0.2,
  roundWins: 60,
  roundLosses: 50,
  roundDraws: 4,
  gameWins: 140,
  gameLosses: 120,
  gameWinRate: 0.538,
  roundWinRate: 0.545,
  wilsonLow: 0.451,
  wilsonHigh: 0.636,
  byEvent: [],
  ...over,
});

const matchup = (
  a: ArchetypeId,
  b: ArchetypeId,
  over: Partial<MatchupStats> = {},
): MatchupStats => ({
  seasonId: season,
  archetypeA: a,
  archetypeB: b,
  matches: 30,
  aMatchWins: 18,
  bMatchWins: 11,
  matchDraws: 1,
  aGameWins: 40,
  bGameWins: 32,
  aWinRate: 0.6,
  wilsonLow: 0.423,
  wilsonHigh: 0.754,
  ...over,
});

describe.skipIf(!reachable)("repos/stats", () => {
  afterAll(async () => {
    // The season cascades to five of the six tables. `deck_metrics` hangs off
    // the deck instead, which the deck's own delete takes with it.
    await service.from("seasons").delete().eq("id", season);
    await service.from("decks").delete().in("id", [publicDeck, otherDeck, privateDeck]);
  });

  describe("deck metrics", () => {
    it("reads back what was written, mapped to the contract", async () => {
      await upsertDeckMetrics(service, [metricsFor(publicDeck)]);
      const metrics = await getDeckMetrics(client, publicDeck);

      expect(metrics?.maindeckCount).toBe(60);
      expect(metrics?.avgMvInclLands).toBe(2.15);
      expect(metrics?.colorIdentity).toEqual(["W", "U"]);
      expect(metrics?.mvBuckets["2"]).toBe(12);
      expect(metrics?.setCounts["FDN"]).toBe(20);
      expect(metrics?.unresolvedCards).toBe(0);
    });

    it("keeps a null rate null rather than turning it into zero", async () => {
      await upsertDeckMetrics(service, [
        metricsFor(otherDeck, { avgMvSideboard: null, totalMv: null, colorIdentity: null }),
      ]);
      const metrics = await getDeckMetrics(client, otherDeck);

      // A deck with no sideboard has no sideboard average. `Number(null)` is 0,
      // which would read as a sideboard of nothing but free spells.
      expect(metrics?.avgMvSideboard).toBeNull();
      expect(metrics?.totalMv).toBeNull();
      expect(metrics?.colorIdentity).toBeNull();
    });

    it("recomputes one deck without disturbing another", async () => {
      await upsertDeckMetrics(service, [metricsFor(publicDeck, { maindeckCount: 61 })]);

      expect((await getDeckMetrics(client, publicDeck))?.maindeckCount).toBe(61);
      expect(await getDeckMetrics(client, otherDeck)).not.toBeNull();
    });

    it("hides a private deck's metrics from the public client", async () => {
      await upsertDeckMetrics(service, [metricsFor(privateDeck)]);

      // The curve would disclose that the deck exists and roughly what is in it,
      // which is the whole of what `private` is for.
      expect(await getDeckMetrics(client, privateDeck)).toBeNull();
      expect(await getDeckMetrics(service, privateDeck)).not.toBeNull();
    });

    it("reads a set of decks in one round trip, skipping the private one", async () => {
      const many = await listDeckMetrics(client, [publicDeck, otherDeck, privateDeck]);
      expect(many.map((m) => m.deckId).sort()).toEqual([publicDeck, otherDeck].sort());
    });

    it("writes nothing when there is nothing to write", async () => {
      await expect(upsertDeckMetrics(service, [])).resolves.toBeUndefined();
      expect(await listDeckMetrics(client, [])).toEqual([]);
    });
  });

  describe("card stats", () => {
    it("orders the most-played first and carries the n behind every rate", async () => {
      await replaceCardStats(service, season, [
        cardStat(BOLT, { inclusionRate: 0.62, decksIncluding: 62 }),
        cardStat(COUNTERSPELL, { inclusionRate: 0.31, decksIncluding: 31 }),
      ]);

      const top = await listCardStats(client, season, "main", 10);
      expect(top.map((card) => card.oracleId)).toEqual([BOLT, COUNTERSPELL]);
      expect(top[0]?.inclusionRate).toBe(0.62);
      // The rate and its sample travel together; `suppress-small-n` is the
      // caller's job and it needs both.
      expect(top[0]?.decksIncluding).toBe(62);
      expect(top[0]?.gameWins).toBe(120);
      expect(top[0]?.archetypeBreakdown[0]?.share).toBe(0.75);
      expect(top[0]?.byEvent[0]?.stats.deckCount).toBe(32);
    });

    it("keeps the two boards apart", async () => {
      await replaceCardStats(service, season, [
        cardStat(BOLT, { board: "main", inclusionRate: 0.62 }),
        cardStat(BOLT, { board: "side", inclusionRate: 0.12 }),
      ]);

      const side = await listCardStats(client, season, "side", 10);
      expect(side.map((card) => card.inclusionRate)).toEqual([0.12]);

      const both = await getCardStats(client, season, BOLT);
      expect(both.map((card) => card.board)).toEqual(["main", "side"]);
    });

    it("suppresses nothing, and leaves an unplayed card's rate null", async () => {
      await replaceCardStats(service, season, [
        cardStat(BOLT, { winRate: null, gameWins: 0, gameLosses: 0 }),
      ]);

      const [card] = await listCardStats(client, season, "main", 10);
      expect(card?.winRate).toBeNull();
    });

    it("replaces the season wholesale", async () => {
      await replaceCardStats(service, season, [cardStat(BOLT)]);
      await replaceCardStats(service, season, [cardStat(COUNTERSPELL)]);

      expect((await listCardStats(client, season, "main", 10)).map((c) => c.oracleId)).toEqual([
        COUNTERSPELL,
      ]);
    });

    it("clears the season when the recompute found nothing", async () => {
      await replaceCardStats(service, season, []);
      expect(await listCardStats(client, season, "main", 10)).toEqual([]);
    });
  });

  describe("archetype stats", () => {
    it("returns the metagame largest share first", async () => {
      await replaceArchetypeStats(service, season, [
        archetypeStat(GOLGARI, { shareOfField: 0.18 }),
        archetypeStat(AZORIUS, { shareOfField: 0.27 }),
      ]);

      const field = await listArchetypeStats(client, season);
      expect(field.map((row) => row.archetypeId)).toEqual([AZORIUS, GOLGARI]);
      expect(field[0]?.shareOfField).toBe(0.27);
      expect(field[0]?.wilsonLow).toBe(0.451);
      expect(field[0]?.roundWins).toBe(60);
    });

    it("keeps a null rate null", async () => {
      await replaceArchetypeStats(service, season, [
        archetypeStat(AZORIUS, {
          roundWinRate: null,
          gameWinRate: null,
          wilsonLow: null,
          wilsonHigh: null,
        }),
      ]);

      const [only] = await listArchetypeStats(client, season);
      expect(only?.roundWinRate).toBeNull();
      expect(only?.wilsonHigh).toBeNull();
    });
  });

  describe("matchups", () => {
    it("stores one row per pair and reports every rate from A's side", async () => {
      const [first, second] = [AZORIUS, GOLGARI].sort() as [ArchetypeId, ArchetypeId];
      await replaceMatchupStats(service, season, [matchup(first, second)]);

      const matrix = await listMatchupStats(client, season);
      expect(matrix).toHaveLength(1);
      expect(matrix[0]?.aWinRate).toBe(0.6);
      expect(matrix[0]?.matches).toBe(30);
      // The pair is stored in one order, so the cell reads the same whichever
      // side asked for it. B's rate is derivable from these and deliberately not
      // stored: two rates for one matchup is two chances to disagree.
      expect(matrix[0]?.archetypeA).toBe(first);
      expect(matrix[0]?.archetypeB).toBe(second);
      expect(
        (matrix[0]?.aMatchWins ?? 0) + (matrix[0]?.bMatchWins ?? 0) + (matrix[0]?.matchDraws ?? 0),
      ).toBe(matrix[0]?.matches);
    });

    it("finds an archetype on whichever side of the pair it sits", async () => {
      const [a1, b1] = [AZORIUS, GOLGARI].sort() as [ArchetypeId, ArchetypeId];
      const [a2, b2] = [GOLGARI, ABZAN].sort() as [ArchetypeId, ArchetypeId];
      await replaceMatchupStats(service, season, [
        matchup(a1, b1, { matches: 30 }),
        matchup(a2, b2, { matches: 12 }),
      ]);

      const golgari = await listMatchupsForArchetype(client, season, GOLGARI);
      expect(golgari).toHaveLength(2);
      expect(golgari.map((row) => row.matches)).toEqual([30, 12]);
    });
  });

  describe("the archetype map", () => {
    it("stores an undirected edge once", async () => {
      await replaceSimilarityEdges(service, season, [
        { seasonId: season, deckA: deckA, deckB: deckB, similarity: 0.72, sharedCards: 48 },
      ]);

      const edges = await listSimilarityEdges(client, season);
      expect(edges).toHaveLength(1);
      expect(edges[0]?.similarity).toBe(0.72);
      expect(edges[0]?.sharedCards).toBe(48);
    });

    it("refuses an edge stored the wrong way round", async () => {
      // `deck_a < deck_b` is a check constraint, and an edge counted twice is a
      // map drawn wrong rather than an error anybody would notice.
      await expect(
        replaceSimilarityEdges(service, season, [
          { seasonId: season, deckA: deckB, deckB: deckA, similarity: 0.72, sharedCards: 48 },
        ]),
      ).rejects.toThrow(/replaceSimilarityEdges failed/);
    });

    it("hides an edge that touches a private deck", async () => {
      const [a, b] = [publicDeck, privateDeck].sort() as [DeckId, DeckId];
      await replaceSimilarityEdges(service, season, [
        { seasonId: season, deckA: a, deckB: b, similarity: 0.8, sharedCards: 50 },
      ]);

      // Both ends, not either: an edge is only publishable if both decks are.
      expect(await listSimilarityEdges(client, season)).toEqual([]);
      expect(await listSimilarityEdges(service, season)).toHaveLength(1);
    });

    it("replaces a layout wholesale", async () => {
      await replaceLayout(service, season, [
        { seasonId: season, deckId: publicDeck, x: 12.5, y: -4.25, layoutVersion: 1 },
        { seasonId: season, deckId: otherDeck, x: -8, y: 3, layoutVersion: 1 },
      ]);
      await replaceLayout(service, season, [
        { seasonId: season, deckId: publicDeck, x: 99, y: 1, layoutVersion: 2 },
      ]);

      const points = await listLayoutPoints(client, season);
      expect(points).toHaveLength(1);
      expect(points[0]?.x).toBe(99);
      expect(points[0]?.layoutVersion).toBe(2);
    });
  });
});
