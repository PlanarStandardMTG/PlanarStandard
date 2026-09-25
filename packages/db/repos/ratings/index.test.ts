import type { MatchId, PlayerId, PlayerRating, RatingEvent, TournamentId } from "@ps/contracts";
import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";

import {
  getLeaderboard,
  getProvisionalRatings,
  getPlayerRating,
  getRatingConfig,
  listRatingHistory,
  listRatingRuns,
  recordRatingRun,
  replaceRatings,
} from "./index";

/**
 * Runs against a local Supabase with the seed loaded (`pnpm db:reset`).
 *
 * `replaceRatings` clears both rating tables by design — it is a full recompute
 * (ADR 004) — so this suite cannot scope its writes by id the way the others do.
 * Nothing else in the repository writes a rating, and the tables have no seed,
 * so clearing them is what they already do. The players it creates are still
 * removed by id.
 *
 * Skipped rather than failed when nothing is listening, as with every suite here.
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

const created: string[] = [];
const imports: string[] = [];

/**
 * The seeded event this suite writes matches to, and **not** the one
 * `repos/results` uses.
 *
 * Test files run in parallel, and `replaceTournamentMatches` clears every match
 * of a tournament — that is what it is for. Two suites sharing one seeded event
 * therefore delete each other's ledger rows, which surfaces here as a
 * foreign-key violation on `rating_events.match_id`. A suite that writes matches
 * claims a tournament of its own.
 */
const LEDGER_TOURNAMENT = "planar-standard-weekly-38";

async function makePlayer(
  name: string,
  visibility: "public" | "hidden" = "public",
): Promise<PlayerId> {
  const { data, error } = await service
    .from("players")
    .insert({ display_name: name, slug: `vitest-ratings-${name}-${Date.now()}`, visibility })
    .select("id")
    .single();
  if (error !== null) throw new Error(`could not create a player: ${error.message}`);

  const id = (data as { id: string }).id;
  created.push(id);
  return id as PlayerId;
}

const rating = (playerId: PlayerId, over: Partial<PlayerRating> = {}): PlayerRating => ({
  playerId,
  rating: 1700,
  peakRating: 1720,
  matchesPlayed: 20,
  wins: 14,
  losses: 5,
  draws: 1,
  tournamentsPlayed: 5,
  lastPlayed: "2026-08-22",
  isProvisional: false,
  isActive: true,
  ...over,
});

/**
 * A committed match to hang rating events on.
 *
 * `rating_events.match_id` has a foreign key and nothing seeds `matches`, so the
 * history test has to build one. Written directly rather than through
 * `repos/results` — this suite is testing the rating reads, and going through
 * another repository to set up would make a failure there look like a failure
 * here.
 */
async function aRealMatch(): Promise<{ matchId: MatchId; tournamentId: TournamentId }> {
  const { data: tournament } = await service
    .from("tournaments")
    .select("id")
    .eq("slug", LEDGER_TOURNAMENT)
    .single();
  const tournamentId = (tournament as { id: string }).id as TournamentId;

  const { data: imported, error: importError } = await service
    .from("result_imports")
    .insert({
      tournament_id: tournamentId,
      adapter_id: "vitest",
      content_hash: `ratings-${Date.now()}-${Math.random()}`,
      capabilities: ["matches"],
    })
    .select("id")
    .single();
  if (importError !== null) throw new Error(`could not create an import: ${importError.message}`);
  imports.push((imported as { id: string }).id);

  const one = await makePlayer("ledger-one");
  const two = await makePlayer("ledger-two");
  const identities = await Promise.all(
    [one, two].map(async (playerId, index) => {
      const { data, error } = await service
        .from("player_identities")
        .insert({
          player_id: playerId,
          platform: "challonge",
          handle: `vitest-ledger-${index}-${Date.now()}`,
          source: "import_inferred",
        })
        .select("id")
        .single();
      if (error !== null) throw new Error(`could not create an identity: ${error.message}`);
      return (data as { id: string }).id;
    }),
  );

  const { data: match, error } = await service
    .from("matches")
    .insert({
      tournament_id: tournamentId,
      source_import_id: (imported as { id: string }).id,
      round: 1,
      p1_identity_id: identities[0],
      p2_identity_id: identities[1],
      result: "p1_win",
    })
    .select("id")
    .single();
  if (error !== null) throw new Error(`could not create a match: ${error.message}`);

  return { matchId: (match as { id: string }).id as MatchId, tournamentId };
}

describe.skipIf(!reachable)("repos/ratings", () => {
  afterEach(async () => {
    await service.from("rating_events").delete().not("id", "is", null);
    await service.from("player_ratings").delete().not("player_id", "is", null);
    await service.from("rating_runs").delete().not("id", "is", null);
    // Matches before imports before players: each references the next, and
    // none of those foreign keys cascades — a ledger row is not something a
    // stray delete should be able to take with it.
    if (imports.length > 0) {
      await service.from("matches").delete().in("source_import_id", imports);
      await service.from("result_imports").delete().in("id", imports);
    }
    if (created.length > 0) await service.from("players").delete().in("id", created);
    imports.length = 0;
    created.length = 0;
  });

  it("reads the one config row, which every K comes from", async () => {
    // E8.2: nothing in `core/elo` hard-codes a threshold, so if this read is
    // wrong every rating on the site is wrong in the same way.
    const config = await getRatingConfig(client);
    expect(config).toMatchObject({
      initialRating: 1500,
      kProvisional: 40,
      kStandard: 24,
      kElite: 16,
      provisionalMatches: 5,
      minMatchesForLeaderboard: 5,
      countByes: false,
    });
  });

  it("writes a whole replay and reads it back as numbers", async () => {
    const player = await makePlayer("alpha");
    await replaceRatings(service, [rating(player)], []);

    const stored = await getPlayerRating(client, player);
    expect(stored).toMatchObject({ rating: 1700, peakRating: 1720, matchesPlayed: 20 });
    // `numeric` — a rating that came back as "1700" would sort as text and
    // render as text without ever throwing.
    expect(typeof stored?.rating).toBe("number");
  });

  it("replaces wholesale, because a recompute is never incremental", async () => {
    const player = await makePlayer("alpha");
    await replaceRatings(service, [rating(player, { rating: 1700 })], []);
    await replaceRatings(service, [rating(player, { rating: 1650 })], []);

    // ADR 004: the second run is the whole truth, not an adjustment to the first.
    expect((await getPlayerRating(client, player))?.rating).toBe(1650);
  });

  it("empties the tables when a replay produces nothing", async () => {
    const player = await makePlayer("alpha");
    await replaceRatings(service, [rating(player)], []);
    await replaceRatings(service, [], []);

    expect(await getPlayerRating(client, player)).toBeNull();
  });

  it("keeps the rating history in replay order, and refuses a duplicate", async () => {
    const player = await makePlayer("alpha");
    const { matchId, tournamentId } = await aRealMatch();

    const event = (matchNumber: number, ratingAfter: number): RatingEvent => ({
      playerId: player,
      matchId,
      tournamentId,
      opponentId: null,
      eventDate: "2026-08-22",
      ratingBefore: 1500,
      ratingAfter,
      expectedScore: 0.5,
      actualScore: 1,
      kFactor: 24,
      matchNumber,
    });

    await replaceRatings(service, [rating(player)], [event(1, 1524)]);

    const history = await listRatingHistory(client, player);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ matchNumber: 1, ratingAfter: 1524, kFactor: 24 });
    // `numeric` again: a k-factor that came back as "24" would concatenate
    // rather than add anywhere downstream that touched it.
    expect(typeof history[0]?.kFactor).toBe("number");

    // `unique (player_id, match_id)`: a replay that emitted two events for one
    // player and one match would be double-counting, which is the
    // `duplicate-match-id` anomaly rather than something to apply twice (E8.5).
    await expect(
      replaceRatings(service, [rating(player)], [event(1, 1524), event(2, 1548)]),
    ).rejects.toThrow(/writing events/);
  });

  it("puts only qualifying players on the leaderboard, highest first", async () => {
    const top = await makePlayer("top");
    const second = await makePlayer("second");
    const provisional = await makePlayer("provisional");
    const hidden = await makePlayer("hidden", "hidden");
    const thin = await makePlayer("thin");

    await replaceRatings(
      service,
      [
        rating(top, { rating: 1900 }),
        rating(second, { rating: 1800 }),
        rating(provisional, { rating: 2000, isProvisional: true }),
        rating(hidden, { rating: 2100 }),
        // Under `min_matches_for_leaderboard` (5).
        rating(thin, { rating: 1950, matchesPlayed: 4 }),
      ],
      [],
    );

    const board = await getLeaderboard(client, 10);
    // The three excluded each fail a different clause of the view, and each
    // would otherwise have been at the top.
    expect(board.map((row) => row.rating)).toEqual([1900, 1800]);

    // The complement, for the page's second table: the two that are not there
    // yet, and never the hidden one.
    const waiting = await getProvisionalRatings(client, 10);
    expect(waiting.map((row) => row.rating)).toEqual([2000, 1950]);
  });

  it("still gives a provisional player their own rating", async () => {
    // They are off the leaderboard, not unrated — their own page shows it.
    const player = await makePlayer("provisional");
    await replaceRatings(service, [rating(player, { isProvisional: true })], []);

    expect(await getPlayerRating(client, player)).not.toBeNull();
    expect(await getLeaderboard(client, 10)).toEqual([]);
  });

  it("hides a hidden player's rating from the public client entirely", async () => {
    const player = await makePlayer("hidden", "hidden");
    await replaceRatings(service, [rating(player)], []);

    // Not merely absent from the view — absent from the table read too. Their
    // matches still moved everyone else's numbers; they simply do not appear.
    expect(await getPlayerRating(client, player)).toBeNull();
    expect(await getPlayerRating(service, player)).not.toBeNull();
  });

  it("logs a run with its anomalies, and keeps it out of public reach", async () => {
    const run = await recordRatingRun(service, {
      trigger: "vitest",
      matchCount: 120,
      playerCount: 31,
      durationMs: 42,
      anomalies: [
        {
          kind: "self-play",
          matchId: "00000000-0000-4000-8000-000000000001" as MatchId,
          tournamentId: "00000000-0000-4000-8000-000000000002" as TournamentId,
          playerId: "00000000-0000-4000-8000-000000000003" as PlayerId,
          detail: "both sides resolved to the same player",
        },
      ],
    });

    expect(run.anomalies).toHaveLength(1);
    expect(run.anomalies[0]?.kind).toBe("self-play");
    expect((await listRatingRuns(service, 5)).map((r) => r.trigger)).toContain("vitest");

    // `rating_runs` has no read policy: its anomalies name players in the
    // context of something having gone wrong with their data.
    const { data } = await client.from("rating_runs").select("id");
    expect(data).toEqual([]);
  });
});
