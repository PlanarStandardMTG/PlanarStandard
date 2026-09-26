import { readFileSync } from "node:fs";

import { meleeApi } from "@ps/adapters";
import type { IsoDate, RawInput } from "@ps/contracts";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * The fixture event, ingested into a local Supabase (`pnpm db:start`); skipped
 * without one. The recompute is stubbed — a real one replaces every rating and
 * would pull the ladder out from under the db suites running beside this — so
 * this asserts that a rated event asks for one, and `recompute-ratings`' own
 * test covers what it does.
 *
 * Handles and the event id carry a per-run tag, and every row made is deleted
 * by id afterwards.
 */
const recomputeRatings = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/lib/ratings/recompute-ratings.server", () => ({ recomputeRatings }));

const { ingestEvent } = await import("./ingest-event.server");

const url = process.env["SUPABASE_URL"] ?? "http://127.0.0.1:54321";
const serviceKey =
  process.env["SUPABASE_LOCAL_SERVICE_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const reachable = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: serviceKey },
  signal: AbortSignal.timeout(1500),
})
  .then((r) => r.ok)
  .catch(() => false);

const service = createClient(url, serviceKey);
const tag = String(Date.now()).slice(-8);

/** The committed fixture, re-tagged so this run's handles and event are its own. */
function bundle(over: (b: Record<string, unknown>) => void = () => {}): RawInput {
  const raw = readFileSync(
    new URL("../../../../fixtures/melee-api/results-bundle.json", import.meta.url),
    "utf8",
  );
  const parsed = JSON.parse(raw.replace(/"username": "([^"]+)"/g, `"username": "$1-${tag}"`));
  parsed.tournament.name = `Monthly Championship Series - Vitest ${tag}`;
  over(parsed);
  const text = JSON.stringify(parsed);
  return { fileName: "melee-test.json", bytes: new TextEncoder().encode(text), text };
}

const source = (input: RawInput, externalId = `vitest-${tag}`) => ({
  source: "melee" as const,
  externalId,
  adapter: meleeApi,
  input,
  fallbackDate: "2026-09-20" as IsoDate,
});

const tournaments = new Set<string>();

/** Placed finishers by handle. */
async function placements(tournamentId: string): Promise<Record<string, number>> {
  const { data } = await service
    .from("tournament_entries")
    .select("placement, players (player_identities (handle))")
    .eq("tournament_id", tournamentId)
    .not("placement", "is", null);
  const rows = (data ?? []) as unknown as {
    placement: number;
    players: { player_identities: { handle: string }[] };
  }[];
  return Object.fromEntries(
    rows.map((r) => [r.players.player_identities[0]?.handle ?? "", r.placement]),
  );
}

describe.skipIf(!reachable)("lib/results/ingest-event", () => {
  afterAll(async () => {
    const ids = [...tournaments];
    const { data: matches } = await service
      .from("matches")
      .select("p1_identity_id, p2_identity_id")
      .in("tournament_id", ids);
    const identities = new Set(
      (matches ?? []).flatMap((m) => [m.p1_identity_id, m.p2_identity_id]).filter(Boolean),
    );
    const { data: owners } = await service
      .from("player_identities")
      .select("player_id")
      .in("id", [...identities]);

    await service.from("matches").delete().in("tournament_id", ids);
    await service.from("result_imports").delete().in("tournament_id", ids);
    await service.from("tournaments").delete().in("id", ids);
    await service
      .from("players")
      .delete()
      .in(
        "id",
        (owners ?? []).map((o) => o.player_id),
      );
  });

  it("writes a rated Monthly with its players and matches, and recomputes", async () => {
    const report = await ingestEvent(service, source(bundle()));
    tournaments.add(report.tournament.id);

    expect(report.tournament).toMatchObject({
      isRated: true,
      status: "results_imported",
      eventDate: "2026-09-20",
      rounds: 5,
      playerCount: 5,
    });
    // Twelve pairings; the one melee left without a result is not committed.
    expect(report.matches).toBe(11);
    expect(report.issues.map((i) => i.code)).toContain("no-result");
    expect(recomputeRatings).toHaveBeenCalledWith(service, `ingest:melee:vitest-${tag}`);

    const { data: players } = await service
      .from("player_identities")
      .select("handle, platform")
      .like("handle", `%-${tag}`);
    expect(players?.map((p) => p.handle).sort()).toEqual(
      ["Arcane Owl", "Mossback", "pilot-7", "zed_zed"].map((h) => `${h}-${tag}`).sort(),
    );
    expect(await placements(report.tournament.id)).toEqual({
      [`pilot-7-${tag}`]: 1,
      [`Mossback-${tag}`]: 3,
      [`Arcane Owl-${tag}`]: 4,
    });
  });

  it("writes nothing new for a payload it has already committed but its standings", async () => {
    recomputeRatings.mockClear();
    const [id] = [...tournaments];
    await service.from("tournament_entries").delete().eq("tournament_id", id);
    const report = await ingestEvent(service, source(bundle()));

    expect(report.written).toBe(false);
    expect(recomputeRatings).not.toHaveBeenCalled();
    expect(Object.keys(await placements(report.tournament.id))).toHaveLength(3);
  });

  it("supersedes the earlier import and replaces the matches on a changed payload", async () => {
    const report = await ingestEvent(
      service,
      source(bundle((b) => (b["matches"] = (b["matches"] as unknown[]).slice(0, 2)))),
    );

    expect(report.matches).toBe(2);
    const { data: imports } = await service
      .from("result_imports")
      .select("status")
      .eq("tournament_id", report.tournament.id);
    expect(imports?.map((i) => i.status).sort()).toEqual(["committed", "superseded"]);
    const { count } = await service
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", report.tournament.id);
    expect(count).toBe(2);
  });

  it("stores an event that is not a Monthly, unrated, and does not recompute", async () => {
    recomputeRatings.mockClear();
    const report = await ingestEvent(
      service,
      source(
        bundle(
          (b) =>
            ((b["tournament"] as Record<string, unknown>)["name"] = `Mid-Month Madness ${tag}`),
        ),
        `vitest-side-${tag}`,
      ),
    );
    tournaments.add(report.tournament.id);

    expect(report.tournament.isRated).toBe(false);
    expect(report.matches).toBe(11);
    expect(recomputeRatings).not.toHaveBeenCalled();
  });
});
