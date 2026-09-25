import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

import { resolveEventHandles } from "./resolve-handles.server";

/**
 * Runs against a local Supabase (`pnpm db:start`) and skips without one. Handles
 * carry a per-run tag so parallel suites and earlier runs never collide on
 * `unique (platform, normalized)`; players are deleted by id afterwards.
 */
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
const players = new Set<string>();

async function playerOf(identityId: string | undefined): Promise<string> {
  const { data } = await service
    .from("player_identities")
    .select("player_id")
    .eq("id", identityId ?? "")
    .single();
  const playerId = (data as { player_id: string }).player_id;
  players.add(playerId);
  return playerId;
}

describe.skipIf(!reachable)("lib/results/resolve-handles", () => {
  afterAll(async () => {
    if (players.size > 0)
      await service
        .from("players")
        .delete()
        .in("id", [...players]);
  });

  it("creates a player on first sight and finds the same identity on the next event", async () => {
    const first = await resolveEventHandles(service, "melee", [`Rook ${tag}`]);
    const again = await resolveEventHandles(service, "melee", [`rook_${tag}`]);

    expect(first.issues).toEqual([]);
    expect(again.identities.get(`rook_${tag}`)).toBe(first.identities.get(`Rook ${tag}`));
    await playerOf(first.identities.get(`Rook ${tag}`));
  });

  it("links a handle across platforms to the player who already has it", async () => {
    const onChallonge = await resolveEventHandles(service, "challonge", [`Bishop${tag}`]);
    const onMelee = await resolveEventHandles(service, "melee", [`bishop-${tag}`]);

    const challongeIdentity = onChallonge.identities.get(`Bishop${tag}`);
    const meleeIdentity = onMelee.identities.get(`bishop-${tag}`);
    expect(meleeIdentity).not.toBe(challongeIdentity);
    expect(await playerOf(meleeIdentity)).toBe(await playerOf(challongeIdentity));
  });

  it("gives a new player a free slug when the handle's is already taken", async () => {
    const { data } = await service
      .from("players")
      .insert({ display_name: "squatter", slug: `knight-${tag}` })
      .select("id")
      .single();
    players.add((data as { id: string }).id);

    const result = await resolveEventHandles(service, "melee", [`Knight ${tag}`]);
    const { data: created } = await service
      .from("players")
      .select("slug")
      .eq("id", await playerOf(result.identities.get(`Knight ${tag}`)))
      .single();

    expect((created as { slug: string }).slug).toBe(`knight-${tag}-2`);
  });

  it("commits nobody for two handles in one event that normalize alike", async () => {
    const result = await resolveEventHandles(service, "melee", [`Pawn ${tag}`, `pawn_${tag}`]);

    expect(result.identities.size).toBe(0);
    expect(result.issues[0]?.code).toBe("colliding-handles");
  });
});
