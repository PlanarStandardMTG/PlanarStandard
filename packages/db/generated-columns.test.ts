import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

/**
 * E9.1's acceptance criterion, finally asserted against Postgres.
 *
 * `core/identity/normalize-handle` and the generated column on
 * `player_identities` must agree. Neither package may import the other, so both
 * read `fixtures/identity/normalized-handles.json` — the core test checks the
 * function against it, this one checks the database.
 *
 * Skipped rather than failed when nothing is listening, as with every other
 * suite in this package.
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

const parity: ReadonlyArray<{ handle: string; normalized: string }> = JSON.parse(
  readFileSync(new URL("../../fixtures/identity/normalized-handles.json", import.meta.url), "utf8"),
);

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

/** Its own player, removed afterwards: `pnpm test` leaves no rows behind. */
const TEST_SLUG = "vitest-normalized-handles";

async function testPlayerId(): Promise<string> {
  await db.from("players").delete().eq("slug", TEST_SLUG);
  const { data, error } = await db
    .from("players")
    .insert({ display_name: "vitest", slug: TEST_SLUG, visibility: "hidden" })
    .select("id")
    .single();
  if (error !== null) throw new Error(`could not create the test player: ${error.message}`);
  return (data as { id: string }).id;
}

describe.skipIf(!reachable)("db — generated columns", () => {
  afterAll(async () => {
    await db.from("players").delete().eq("slug", TEST_SLUG);
  });

  it("normalizes every handle in the parity table the way core does", async () => {
    const playerId = await testPlayerId();
    const produced: Record<string, string> = {};

    // One at a time: `unique (platform, normalized)` is the point of the column,
    // and two of these handles normalize to the same empty string.
    for (const { handle } of parity) {
      const { data, error } = await db
        .from("player_identities")
        .insert({ player_id: playerId, platform: "manual", handle, source: "admin_assigned" })
        .select("normalized")
        .single();

      expect(error, `inserting ${JSON.stringify(handle)}`).toBeNull();
      produced[handle] = (data as { normalized: string }).normalized;
      await db.from("player_identities").delete().eq("player_id", playerId);
    }

    expect(produced).toEqual(Object.fromEntries(parity.map((r) => [r.handle, r.normalized])));
  });

  it("refuses a second identity that normalizes onto an existing one", async () => {
    const playerId = await testPlayerId();

    const first = await db.from("player_identities").insert({
      player_id: playerId,
      platform: "challonge",
      handle: "Flod_Lawjick",
      source: "import_inferred",
    });
    const second = await db.from("player_identities").insert({
      player_id: playerId,
      platform: "challonge",
      handle: "flod lawjick",
      source: "import_inferred",
    });

    expect(first.error).toBeNull();
    expect(second.error?.code).toBe("23505");
  });

  it("scopes that uniqueness to one platform, because one string is two people", async () => {
    const playerId = await testPlayerId();

    const challonge = await db.from("player_identities").insert({
      player_id: playerId,
      platform: "challonge",
      handle: "Sunsett",
      source: "import_inferred",
    });
    const discord = await db.from("player_identities").insert({
      player_id: playerId,
      platform: "discord",
      handle: "Sunsett",
      source: "discord_oauth",
    });

    expect(challonge.error).toBeNull();
    expect(discord.error).toBeNull();
  });

  it("hides a hidden player, and their handles with them", async () => {
    const playerId = await testPlayerId();
    await db.from("player_identities").insert({
      player_id: playerId,
      platform: "manual",
      handle: "Sunsett",
      source: "organizer_entered",
    });

    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: players } = await anon.from("players").select("id").eq("slug", TEST_SLUG);
    const { data: identities } = await anon
      .from("player_identities")
      .select("id")
      .eq("player_id", playerId);

    expect(players).toEqual([]);
    expect(identities).toEqual([]);
  });
});
