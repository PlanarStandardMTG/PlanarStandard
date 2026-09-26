import type { IdentityId, PlayerId, ProfileId, TournamentId } from "@ps/contracts";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

import {
  addIdentity,
  createPlayerWithIdentity,
  findIdentityByNormalizedHandle,
  listIdentitiesByNormalized,
  getPlayer,
  getPlayerByProfile,
  getPlayerBySlug,
  listExclusions,
  listIdentitiesByPlayer,
  listPendingMergeSuggestions,
  listPlayerMerges,
  markPlayerMerged,
  recordExclusions,
  recordPlayerMerge,
  repointPlayerRows,
  replaceMergeSuggestions,
  setPlayerProfile,
  reviewMergeSuggestion,
} from "./index";

/**
 * Runs against a local Supabase with the seed loaded (`pnpm db:reset`).
 *
 * There are no seeded players — E13.5 deliberately ships none — so this suite
 * makes its own and deletes them afterwards **by id**. Vitest runs test files in
 * parallel, and a suite that clears a whole table clears it out from under
 * whoever else is using it.
 *
 * `players` and `player_identities` are also what `repos/results` and
 * `generated-columns` write to, so every handle and slug here carries a per-run
 * tag. Without it two suites both claiming `Sunsett` on Challonge collide on the
 * `unique (platform, normalized)` index — a real constraint, failing for a reason
 * that has nothing to do with what either suite is testing.
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

const run = Date.now();
let seq = 0;
const slug = (name: string): string => `vitest-identity-${run}-${name}-${seq++}`;

/** Digits only, so it survives normalization as itself and the two forms stay predictable. */
const tag = String(run).slice(-8);
const raw = (base: string): string => `${base} ${tag}`;
const norm = (base: string): string => `${base.toLowerCase().replace(/[^a-z0-9]/g, "")}${tag}`;

const players: string[] = [];
const decks: string[] = [];
const entries: string[] = [];
const matches: string[] = [];
const merges: string[] = [];

/** This suite claims its own event, so a repoint here cannot disturb another's. */
const showcase = reachable
  ? ((
      (await service.from("tournaments").select("id").eq("slug", "community-showcase").single())
        .data as { id: string }
    ).id as TournamentId)
  : ("" as TournamentId);

async function aPlayer(base: string, over: { visibility?: "public" | "hidden" } = {}) {
  const identity = await createPlayerWithIdentity(service, {
    displayName: base,
    slug: slug(base),
    platform: "challonge",
    handle: raw(base),
    source: "import_inferred",
    ...(over.visibility === undefined ? {} : { visibility: over.visibility }),
  });
  players.push(identity.playerId);
  return identity;
}

describe.skipIf(!reachable)("repos/identity", () => {
  afterAll(async () => {
    // Order matters: only identities, suggestions and exclusions cascade from a
    // player. The rest reference it without one, on purpose — a player is not
    // something a delete should be able to take history with.
    if (matches.length > 0) await service.from("matches").delete().in("id", matches);
    if (merges.length > 0) await service.from("player_merges").delete().in("id", merges);
    if (entries.length > 0) await service.from("tournament_entries").delete().in("id", entries);
    if (decks.length > 0) await service.from("decks").delete().in("id", decks);
    if (players.length > 0) await service.from("players").delete().in("id", players);
  });

  it("reads a handle back under the form the generated column stored", async () => {
    const created = await aPlayer("Zaunus 13");

    // What core/identity/normalize-handle produces for the same string. The two
    // are pinned to one fixture; this asserts the lookup uses that form.
    const found = await findIdentityByNormalizedHandle(service, "challonge", norm("Zaunus 13"));

    expect(found?.id).toBe(created.id);
    expect(found?.handle.raw).toBe(raw("Zaunus 13"));
    expect(found?.handle.normalized).toBe(norm("Zaunus 13"));
    expect(found?.isPrimary).toBe(true);
  });

  it("misses on a handle nobody has sent, which is how a new player starts", async () => {
    expect(await findIdentityByNormalizedHandle(service, "melee", `unseen${run}`)).toBeNull();
  });

  it("keeps the same string on two platforms as two people", async () => {
    const onChallonge = await aPlayer("Sunsett");
    const player = await aPlayer("elsewhere");
    const onMelee = await addIdentity(service, player.playerId, {
      platform: "melee",
      handle: raw("Sunsett"),
      source: "import_inferred",
    });

    expect(onMelee.playerId).not.toBe(onChallonge.playerId);
    expect(
      (await findIdentityByNormalizedHandle(service, "melee", norm("Sunsett")))?.playerId,
    ).toBe(player.playerId);
  });

  it("reads a batch of normalized handles across every platform", async () => {
    const onChallonge = await aPlayer("Crossover");
    const other = await aPlayer("unrelated");
    const onMelee = await addIdentity(service, other.playerId, {
      platform: "melee",
      handle: raw("cross-over"),
      source: "import_inferred",
    });

    const found = await listIdentitiesByNormalized(service, [
      norm("Crossover"),
      norm("Crossover"),
      `unseen${run}`,
    ]);

    expect(found.map((identity) => identity.id).sort()).toEqual(
      [onChallonge.id, onMelee.id].sort(),
    );
    expect(await listIdentitiesByNormalized(service, [])).toEqual([]);
  });

  it("refuses a handle the platform has already given somebody", async () => {
    await aPlayer("Taken");
    const other = await aPlayer("other");

    await expect(
      addIdentity(service, other.playerId, {
        platform: "challonge",
        // The unique index is on `normalized`, so a different spelling of the
        // same handle collides too — which is the point of the column.
        handle: `t-a-k-e-n-${tag}`,
        source: "admin_assigned",
      }),
    ).rejects.toThrow(/addIdentity failed/);
  });

  it("lists a player's handles, primary first", async () => {
    const primary = await aPlayer("Divnyi");
    await addIdentity(service, primary.playerId, {
      platform: "discord",
      handle: raw("divnyi"),
      source: "discord_oauth",
    });

    const all = await listIdentitiesByPlayer(service, primary.playerId);
    expect(all.map((identity) => identity.handle.platform)).toEqual(["challonge", "discord"]);
    expect(all.map((identity) => identity.isPrimary)).toEqual([true, false]);
  });

  it("hides a hidden player from the public client and not from the server", async () => {
    const hidden = await aPlayer("Quiet", { visibility: "hidden" });
    const player = await getPlayer(service, hidden.playerId);

    expect(player?.visibility).toBe("hidden");
    expect(await getPlayer(client, hidden.playerId)).toBeNull();
    expect(await getPlayerBySlug(client, player?.slug ?? "")).toBeNull();
  });

  it("finds a public player by slug", async () => {
    const created = await aPlayer("Findable");
    const viaService = await getPlayer(service, created.playerId);

    const viaSlug = await getPlayerBySlug(client, viaService?.slug ?? "");
    expect(viaSlug?.id).toBe(created.playerId);
    expect(viaSlug?.mergedInto).toBeNull();
    expect(viaSlug?.profileId).toBeNull();
  });

  it("links a player to a member, finds them by it, and unlinks", async () => {
    // Seeded Odis Brackwater (`seed/0001_profiles.sql`); nothing else here links them.
    const member = "11111111-1111-4111-8111-000000000005" as ProfileId;
    const linked = await aPlayer("Linked");

    await setPlayerProfile(service, linked.playerId, member);
    expect((await getPlayerByProfile(client, member))?.id).toBe(linked.playerId);

    await setPlayerProfile(service, linked.playerId, null);
    expect(await getPlayerByProfile(client, member)).toBeNull();
  });

  describe("exclusions", () => {
    it("records a pair once and will not take it back", async () => {
      const a = await aPlayer("excl-a");
      const b = await aPlayer("excl-b");
      const [first, second] = [a.id, b.id].sort() as [IdentityId, IdentityId];

      await recordExclusions(service, [
        { identityA: first, identityB: second, reason: "co_appearance", tournamentId: showcase },
      ]);
      // A re-run of co-appearance-exclusions over a re-imported event. The
      // existing row wins; nothing is removed and nothing is overwritten.
      await recordExclusions(service, [
        { identityA: first, identityB: second, reason: "admin_dismissed", tournamentId: null },
      ]);

      const mine = (await listExclusions(service)).filter((e) => e.identityA === first);
      expect(mine).toHaveLength(1);
      expect(mine[0]?.reason).toBe("co_appearance");
      expect(mine[0]?.tournamentId).toBe(showcase);
    });

    it("shows the public client nothing, because it is an assertion about people", async () => {
      const { data } = await client.from("identity_exclusions").select("identity_a");
      expect(data).toEqual([]);
    });

    it("writes nothing when there is nothing to write", async () => {
      await expect(recordExclusions(service, [])).resolves.toBeUndefined();
    });
  });

  describe("merge suggestions", () => {
    it("queues a scoring run, most confident first", async () => {
      const a = await aPlayer("sug-a");
      const b = await aPlayer("sug-b");
      const c = await aPlayer("sug-c");
      const pair = (x: PlayerId, y: PlayerId) => [x, y].sort() as [PlayerId, PlayerId];

      const [lowA, lowB] = pair(a.playerId, b.playerId);
      const [highA, highB] = pair(a.playerId, c.playerId);

      await replaceMergeSuggestions(service, [
        {
          playerA: lowA,
          playerB: lowB,
          confidence: 0.55,
          evidence: [{ kind: "containment", confidence: 0.55, evidence: { shorter: "sug" } }],
        },
        {
          playerA: highA,
          playerB: highB,
          confidence: 0.95,
          evidence: [{ kind: "parenthetical", confidence: 0.95, evidence: { alias: "sug-c" } }],
        },
      ]);

      const queue = (await listPendingMergeSuggestions(service, 50)).filter(
        (suggestion) => suggestion.playerA === highA || suggestion.playerA === lowA,
      );
      expect(queue.map((suggestion) => suggestion.confidence)).toEqual([0.95, 0.55]);
      expect(queue[0]?.evidence.map((signal) => signal.kind)).toEqual(["parenthetical"]);
      expect(queue[0]?.reviewedBy).toBeNull();
    });

    it("does not resurrect a pair an admin has already answered", async () => {
      const a = await aPlayer("dis-a");
      const b = await aPlayer("dis-b");
      const [playerA, playerB] = [a.playerId, b.playerId].sort() as [PlayerId, PlayerId];
      const suggestion = { playerA, playerB, confidence: 0.6, evidence: [] };

      await replaceMergeSuggestions(service, [suggestion]);
      const [queued] = (await listPendingMergeSuggestions(service, 50)).filter(
        (row) => row.playerA === playerA && row.playerB === playerB,
      );

      const { data: reviewer } = await service.from("profiles").select("id").limit(1).single();
      const dismissed = await reviewMergeSuggestion(service, queued?.id ?? "", {
        status: "dismissed",
        reviewedBy: (reviewer as { id: string }).id,
      });
      expect(dismissed.status).toBe("dismissed");
      expect(dismissed.reviewedAt).not.toBeNull();

      // The scorer still thinks they match. It is not the scorer's call.
      await replaceMergeSuggestions(service, [{ ...suggestion, confidence: 0.99 }]);

      const stillPending = (await listPendingMergeSuggestions(service, 50)).filter(
        (row) => row.playerA === playerA && row.playerB === playerB,
      );
      expect(stillPending).toEqual([]);
    });
  });

  describe("merging", () => {
    it("repoints what a person owns and leaves the ledger alone", async () => {
      const loser = await aPlayer("merge-loser");
      const winner = await aPlayer("merge-winner");
      const opponent = await aPlayer("merge-opponent");

      const { data: deck } = await service
        .from("decks")
        .insert({ name: "vitest merge", player_id: loser.playerId })
        .select("id")
        .single();
      decks.push((deck as { id: string }).id);

      const { data: entry } = await service
        .from("tournament_entries")
        .insert({ tournament_id: showcase, player_id: loser.playerId, placement: 3 })
        .select("id")
        .single();
      entries.push((entry as { id: string }).id);

      const { data: match, error: matchError } = await service
        .from("matches")
        .insert({
          tournament_id: showcase,
          round: 1,
          p1_identity_id: loser.id,
          p2_identity_id: opponent.id,
          result: "p1_win",
        })
        .select("id")
        .single();
      if (matchError !== null) throw new Error(matchError.message);
      matches.push((match as { id: string }).id);

      const moved = await repointPlayerRows(service, loser.playerId, winner.playerId);

      expect(moved.identities).toEqual([loser.id]);
      expect(moved.decks).toEqual([(deck as { id: string }).id]);
      expect(moved.entries).toEqual([(entry as { id: string }).id]);

      // ADR 003: the match still points at the same identity row. Nothing in
      // history changed, which is the whole reason identities exist.
      const { data: after } = await service
        .from("matches")
        .select("p1_identity_id")
        .eq("id", (match as { id: string }).id)
        .single();
      expect((after as { p1_identity_id: string }).p1_identity_id).toBe(loser.id);
      expect(
        (await findIdentityByNormalizedHandle(service, "challonge", norm("merge-loser")))?.playerId,
      ).toBe(winner.playerId);

      await markPlayerMerged(service, loser.playerId, winner.playerId);
      const merged = await getPlayer(service, loser.playerId);
      expect(merged?.mergedInto).toBe(winner.playerId);
      // Off the leaderboard, and off the public read, without being deleted.
      expect(await getPlayer(client, loser.playerId)).toBeNull();

      const { data: reviewer } = await service.from("profiles").select("id").limit(1).single();
      const record = await recordPlayerMerge(service, {
        winnerId: winner.playerId,
        loserId: loser.playerId,
        reason: "same person, two events",
        moved,
        mergedBy: (reviewer as { id: string }).id,
      });
      merges.push(record.id);

      // The audit row is what an undo reads. It has to come back whole.
      const logged = (await listPlayerMerges(service, 50)).find((row) => row.id === record.id);
      expect(logged?.moved).toEqual(moved);
      expect(logged?.loserId).toBe(loser.playerId);
      expect(logged?.reason).toBe("same person, two events");
    });

    it("moves nothing, and says so, when the loser owns nothing", async () => {
      const loser = await aPlayer("empty-loser");
      const winner = await aPlayer("empty-winner");

      const moved = await repointPlayerRows(service, loser.playerId, winner.playerId);
      expect(moved).toEqual({ identities: [loser.id], entries: [], decks: [] });
    });
  });
});
