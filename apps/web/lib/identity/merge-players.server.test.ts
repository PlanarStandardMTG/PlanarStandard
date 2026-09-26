import type { IdentityId, PlayerId } from "@ps/contracts";
import { createPlayerWithIdentity } from "@ps/db";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * Merges against a local Supabase (`pnpm db:start`); skipped without one. The
 * recompute is stubbed — a real one replaces every rating and would pull the
 * ladder out from under the db suites running beside this. Players, handles and
 * events carry a per-run tag and are deleted by id afterwards; events are dated
 * 2020 so no season or "latest event" read elsewhere can see them.
 */
const recomputeRatings = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/lib/ratings/recompute-ratings.server", () => ({ recomputeRatings }));

const { mergePlayers, undoMerge } = await import("./merge-players.server");

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
const players: string[] = [];
const tournaments: string[] = [];

async function player(name: string): Promise<{ id: PlayerId; identity: IdentityId }> {
  const identity = await createPlayerWithIdentity(service, {
    displayName: name,
    slug: `vitest-merge-${name.toLowerCase()}-${tag}`,
    platform: "melee",
    handle: `${name}-${tag}`,
    source: "import_inferred",
  });
  players.push(identity.playerId);
  return { id: identity.playerId, identity: identity.id };
}

async function event(name: string, pairs: readonly (readonly [IdentityId, IdentityId])[]) {
  const { data } = await service
    .from("tournaments")
    .insert({ name, slug: `vitest-merge-${name}-${tag}`, event_date: "2020-02-01" })
    .select("id")
    .single();
  const id = (data as { id: string }).id;
  tournaments.push(id);
  await service.from("matches").insert(
    pairs.map(([p1, p2], i) => ({
      tournament_id: id,
      round: i + 1,
      p1_identity_id: p1,
      p2_identity_id: p2,
      p1_games: 2,
      p2_games: 0,
      result: "p1_win",
    })),
  );
  return id;
}

const ownerOf = async (identity: IdentityId) =>
  (
    (await service.from("player_identities").select("player_id").eq("id", identity).single())
      .data as {
      player_id: string;
    }
  ).player_id;

describe.skipIf(!reachable)("lib/identity/merge-players", () => {
  afterAll(async () => {
    await service.from("matches").delete().in("tournament_id", tournaments);
    await service.from("tournaments").delete().in("id", tournaments);
    await service.from("player_merges").delete().in("winner_id", players);
    await service.from("players").update({ merged_into: null }).in("id", players);
    await service.from("players").delete().in("id", players);
  });

  it("moves the loser's handle to the winner without touching a match, then undoes it", async () => {
    const liko = await player("Liko");
    const likoRs = await player("LikoRS");
    const rival = await player("Rival");
    const t1 = await event("one", [[liko.identity, rival.identity]]);
    await event("two", [[likoRs.identity, rival.identity]]);
    const before = (await service.from("matches").select("*").eq("tournament_id", t1)).data;

    const merged = await mergePlayers(service, {
      winnerId: liko.id,
      loserId: likoRs.id,
      reason: "same person",
      mergedBy: null,
    });

    expect(merged.ok).toBe(true);
    expect(await ownerOf(likoRs.identity)).toBe(liko.id);
    expect((await service.from("matches").select("*").eq("tournament_id", t1)).data).toEqual(
      before,
    );
    expect(recomputeRatings).toHaveBeenCalledWith(service, expect.stringMatching(/^merge:/));

    if (!merged.ok) return;
    expect(await undoMerge(service, merged.merge.id, null)).toEqual({ ok: true });
    expect(await ownerOf(likoRs.identity)).toBe(likoRs.id);
    expect(await undoMerge(service, merged.merge.id, null)).toEqual({
      ok: false,
      reason: "already-undone",
    });
  });

  it("refuses to merge two players who played in the same event, and names it", async () => {
    const a = await player("Alpha");
    const b = await player("Beta");
    const shared = await event("shared", [[a.identity, b.identity]]);

    const outcome = await mergePlayers(service, {
      winnerId: a.id,
      loserId: b.id,
      reason: null,
      mergedBy: null,
    });

    expect(outcome).toEqual({ ok: false, reason: "played-each-other", tournaments: [shared] });
    expect(await ownerOf(b.identity)).toBe(b.id);
  });

  it("refuses a merge into a player who has since been merged away", async () => {
    const x = await player("Xeno");
    const y = await player("Yarrow");
    const z = await player("Zephyr");
    const first = await mergePlayers(service, {
      winnerId: x.id,
      loserId: y.id,
      reason: null,
      mergedBy: null,
    });

    expect(
      await mergePlayers(service, { winnerId: y.id, loserId: z.id, reason: null, mergedBy: null }),
    ).toEqual({
      ok: false,
      reason: "already-merged",
    });
    await mergePlayers(service, { winnerId: z.id, loserId: x.id, reason: null, mergedBy: null });
    if (first.ok) {
      expect(await undoMerge(service, first.merge.id, null)).toEqual({
        ok: false,
        reason: "since-merged",
      });
    }
  });
});
