import type { PlayerId, SeasonId, TournamentId } from "@ps/contracts";
import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";

import {
  getLatestTournamentWithResults,
  getTournamentBySlug,
  listRatedTournamentsBySeason,
  listTournamentEntries,
  listTournamentsBySeason,
} from "./index";

/**
 * Runs against a local Supabase with the seed loaded (`pnpm db:reset`).
 *
 * The tournament reads are asserted against `seed/0007_tournaments.sql`, which
 * was written to carry every status the site renders differently — including the
 * `draft` row, which exists to prove the public-read policy hides it. Entries
 * have no seed (E13.9), so those tests write their own and clean up.
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

/** From `seed/0006_seasons.sql`. */
const SEASON_I = "44444444-4444-4444-8444-000000000001" as SeasonId;
const SEASON_II = "44444444-4444-4444-8444-000000000002" as SeasonId;

async function tournamentId(slug: string): Promise<TournamentId> {
  const tournament = await getTournamentBySlug(client, slug);
  if (tournament === null) throw new Error(`seed is missing ${slug}`);
  return tournament.id;
}

/**
 * Every player this suite creates, so the cleanup can name them.
 *
 * Deleting by a `vitest-%` slug prefix would be tidier and is wrong: vitest runs
 * test files in parallel, and `generated-columns.test.ts` has a `vitest-`
 * player of its own. A broad delete here pulls that row out from under it
 * mid-test, which surfaces as a foreign-key violation in a suite that did
 * nothing wrong.
 */
const created: string[] = [];

async function makePlayer(name: string): Promise<PlayerId> {
  const { data, error } = await service
    .from("players")
    .insert({ display_name: name, slug: `vitest-tournaments-${name}-${Date.now()}` })
    .select("id")
    .single();
  if (error !== null) throw new Error(`could not create a player: ${error.message}`);

  const id = (data as { id: string }).id;
  created.push(id);
  return id as PlayerId;
}

describe.skipIf(!reachable)("repos/tournaments", () => {
  afterEach(async () => {
    if (created.length === 0) return;
    // Entries first: `tournament_entries.player_id` has no cascade, which is
    // correct — a player with history is not something to delete by accident.
    await service.from("tournament_entries").delete().in("player_id", created);
    await service.from("players").delete().in("id", created);
    created.length = 0;
  });

  it("reads one event by slug, mapped to the contract", async () => {
    const weekly = await getTournamentBySlug(client, "planar-standard-weekly-40");

    expect(weekly).toMatchObject({
      name: "Planar Standard Weekly #40",
      eventDate: "2026-08-22",
      platform: "Challonge",
      structure: "swiss",
      rounds: 4,
      playerCount: 31,
      isRated: true,
      status: "results_imported",
    });
    // `numeric` — a string here would multiply a rating by NaN downstream.
    expect(weekly?.weight).toBe(1);
    expect(typeof weekly?.weight).toBe("number");
  });

  it("hides a draft event, which is an organiser's scratch pad", async () => {
    expect(await getTournamentBySlug(client, "season-iii-opener")).toBeNull();
    expect(await getTournamentBySlug(service, "season-iii-opener")).not.toBeNull();
  });

  it("is null for a slug nobody has used", async () => {
    expect(await getTournamentBySlug(client, "no-such-event")).toBeNull();
  });

  it("lists a season's events newest first", async () => {
    const seasonI = await listTournamentsBySeason(client, SEASON_I);
    expect(seasonI.map((t) => t.slug)).toEqual([
      "lorwyn-eclipsed-finale",
      "planar-standard-weekly-12",
      "season-i-opener",
    ]);
  });

  it("returns rated events oldest first, because Elo is path-dependent", async () => {
    // The ordering is the contract: the same matches applied in a different
    // order produce different ratings (ADR 004, E8.4). Descending here would
    // not fail anything — it would quietly produce a different leaderboard.
    const rated = await listRatedTournamentsBySeason(client, SEASON_II);
    const dates = rated.map((t) => t.eventDate);

    expect(dates).toEqual([...dates].sort());
    // Foundations Gauntlet is a Season II event on its own format version — a
    // special pool, still rated, and 13 June puts it first.
    expect(rated.map((t) => t.slug)).toEqual([
      "foundations-gauntlet",
      "planar-standard-weekly-38",
      "planar-standard-weekly-40",
    ]);
  });

  it("leaves a standings-only event out of the rated list", async () => {
    // ADR 006: it is recorded for metagame purposes and rates nothing, because
    // pairings must never be inferred from placements.
    const rated = await listRatedTournamentsBySeason(client, SEASON_II);
    const all = await listTournamentsBySeason(client, SEASON_II);

    expect(all.map((t) => t.slug)).toContain("community-showcase");
    expect(rated.map((t) => t.slug)).not.toContain("community-showcase");
  });

  it("leaves an event still awaiting its results out of the rated list", async () => {
    const rated = await listRatedTournamentsBySeason(client, SEASON_II);
    expect(rated.map((t) => t.slug)).not.toContain("season-ii-wrap-up-gauntlet");
  });

  it("finds the most recent event whose results are in", async () => {
    // Not `season-ii-wrap-up-gauntlet` (29 Aug), which is newer but still
    // awaiting results, and not the draft opener, which is newer still.
    const latest = await getLatestTournamentWithResults(client);
    expect(latest?.slug).toBe("planar-standard-weekly-40");
  });

  it("orders standings best first, with an unplaced entry last rather than dropped", async () => {
    const weekly = await tournamentId("planar-standard-weekly-40");
    const [first, fourth, unplaced] = await Promise.all([
      makePlayer("first"),
      makePlayer("fourth"),
      makePlayer("unplaced"),
    ]);

    await service.from("tournament_entries").insert([
      { tournament_id: weekly, player_id: fourth, placement: 4, match_wins: 3, match_losses: 1 },
      { tournament_id: weekly, player_id: unplaced, placement: null },
      { tournament_id: weekly, player_id: first, placement: 1, match_wins: 5, match_draws: 1 },
    ]);

    const entries = await listTournamentEntries(client, weekly);
    expect(entries.map((e) => e.placement)).toEqual([1, 4, null]);
    expect(entries[0]?.record).toEqual({ wins: 5, losses: 0, draws: 1 });
    expect(entries[2]?.deckId).toBeNull();
  });

  it("gives an entry a 0-0-0 record rather than inventing an absent one", async () => {
    const weekly = await tournamentId("planar-standard-weekly-40");
    const player = await makePlayer("recordless");
    await service.from("tournament_entries").insert({ tournament_id: weekly, player_id: player });

    const [entry] = await listTournamentEntries(client, weekly);
    expect(entry?.record).toEqual({ wins: 0, losses: 0, draws: 0 });
    expect(entry?.dropped).toBe(false);
  });

  it("is empty for an event with no standings", async () => {
    const showcase = await tournamentId("community-showcase");
    expect(await listTournamentEntries(client, showcase)).toEqual([]);
  });
});
