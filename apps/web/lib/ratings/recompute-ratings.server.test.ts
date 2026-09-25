import type { LedgerMatch, RatingConfig } from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The repositories are stubbed: a real recompute replaces every rating in the
 * database, which would pull the ladder out from under the db suites running
 * beside this one. `core/elo/replay` is real — this asserts the wiring.
 */
const db = vi.hoisted(() => ({
  getCurrentSeason: vi.fn(),
  getRatingConfig: vi.fn(),
  listLedgerMatchesBySeason: vi.fn(),
  replaceRatings: vi.fn(async () => {}),
  recordRatingRun: vi.fn(async () => ({})),
}));
vi.mock("@ps/db", () => db);

const { recomputeRatings } = await import("./recompute-ratings.server");

const service = {} as SupabaseClient;
const NOW = new Date("2026-09-25T12:00:00Z");

const CONFIG: RatingConfig = {
  initialRating: 1500,
  kProvisional: 40,
  kStandard: 24,
  kElite: 16,
  provisionalMatches: 10,
  eliteThreshold: 2000,
  minMatchesForLeaderboard: 5,
  inactiveAfterDays: 90,
  countByes: false,
  countEliminationRounds: true,
};

const match = (id: string, p1: string, p2: string): LedgerMatch =>
  ({
    matchId: id,
    tournamentId: "t1",
    eventDate: "2026-09-20",
    tournamentWeight: 1,
    round: 1,
    p1PlayerId: p1,
    p2PlayerId: p2,
    p1Games: 2,
    p2Games: 0,
    gameDraws: 0,
    result: "p1_win",
    isElimination: false,
  }) as LedgerMatch;

beforeEach(() => {
  vi.clearAllMocks();
  db.getRatingConfig.mockResolvedValue(CONFIG);
});

describe("lib/ratings/recompute-ratings", () => {
  it("replays the current season's ledger and replaces every rating with the result", async () => {
    db.getCurrentSeason.mockResolvedValue({ id: "s3" });
    db.listLedgerMatchesBySeason.mockResolvedValue({
      matches: [match("m1", "alice", "bob")],
      unresolved: 0,
    });

    const report = await recomputeRatings(service, "tournament:melee:1", NOW);

    expect(db.listLedgerMatchesBySeason).toHaveBeenCalledWith(service, "s3");
    const [, ratings, events] = db.replaceRatings.mock.calls[0] as unknown as [
      unknown,
      { playerId: string; rating: number }[],
      unknown[],
    ];
    expect(ratings.find((r) => r.playerId === "alice")?.rating).toBeGreaterThan(1500);
    expect(ratings.find((r) => r.playerId === "bob")?.rating).toBeLessThan(1500);
    expect(events).toHaveLength(2);
    expect(report).toMatchObject({ seasonId: "s3", matchesApplied: 1, players: 2 });
  });

  it("logs the run, anomalies included", async () => {
    db.getCurrentSeason.mockResolvedValue({ id: "s3" });
    db.listLedgerMatchesBySeason.mockResolvedValue({
      matches: [match("m1", "alice", "alice")],
      unresolved: 0,
    });

    await recomputeRatings(service, "merge", NOW);

    expect(db.recordRatingRun).toHaveBeenCalledWith(
      service,
      expect.objectContaining({
        trigger: "merge",
        matchCount: 0,
        anomalies: [expect.objectContaining({ kind: "self-play" })],
      }),
    );
  });

  it("empties the ladder when no season is open, rather than keeping a stale one", async () => {
    db.getCurrentSeason.mockResolvedValue(null);

    const report = await recomputeRatings(service, "manual", NOW);

    expect(db.listLedgerMatchesBySeason).not.toHaveBeenCalled();
    expect(db.replaceRatings).toHaveBeenCalledWith(service, [], []);
    expect(report.seasonId).toBeNull();
  });
});
