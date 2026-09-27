import { readFileSync } from "node:fs";

import type { UserRole } from "@ps/contracts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * E14.5 — the allow-deny matrix. **A release blocker when red.**
 *
 * Three suites, because no one of them is enough on its own:
 *
 *   1. Reads, per role. Every table a visitor is meant to see, and — checked
 *      against rows that actually exist — every table they are not. An empty
 *      result and an empty table look identical, so a denial is only asserted
 *      where there is something there to fail to see.
 *   2. Writes, per role. Who is refused, and who gets past the policy.
 *   3. Ladder parity, against `fixtures/auth/role-ladder.json`. The rule lives
 *      in `public.has_role` and in `core/auth/meets-role`, and the two must
 *      agree.
 *
 * Skipped rather than failed when nothing is listening, like every suite here.
 */
const url = process.env["SUPABASE_URL"] ?? "http://127.0.0.1:54321";
const anonKey =
  process.env["SUPABASE_ANON_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
/** Its own variable, never the production service-role name — see `repos/events`. */
const serviceKey =
  process.env["SUPABASE_LOCAL_SERVICE_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const service = createClient(url, serviceKey, { auth: { persistSession: false } });

const online = await anon
  .from("profiles")
  .select("id")
  .limit(1)
  .then(({ error }) => error === null)
  .catch(() => false);

const suite = online ? describe : describe.skip;

/** Postgres says this when a policy refuses a write. Nothing else does. */
const RLS_REFUSED = "42501";

interface LadderPair {
  readonly actual: UserRole;
  readonly required: UserRole;
  readonly meets: boolean;
}

const LADDER = JSON.parse(
  readFileSync(new URL("../../fixtures/auth/role-ladder.json", import.meta.url), "utf8"),
) as readonly LadderPair[];

const ROLES: readonly UserRole[] = ["reader", "writer", "organizer", "admin"];

suite("RLS — the allow-deny matrix", () => {
  const clients = new Map<UserRole, SupabaseClient>();
  const profileIds = new Map<UserRole, string>();
  const userIds: string[] = [];
  /**
   * `players` is the one table every column of which has a default, so the write
   * probe's empty insert genuinely succeeds there rather than failing on a
   * constraint. Its rows are snapshotted so the blank ones can be removed again.
   */
  let playersBefore: readonly string[] = [];

  beforeAll(async () => {
    const stamp = Date.now();

    const { data: existing } = await service.from("players").select("id");
    playersBefore = (existing ?? []).map((row) => row.id as string);

    for (const role of ROLES) {
      const password = `rls-matrix-${role}-${stamp}`;
      const { data, error } = await service.auth.admin.createUser({
        email: `rls-${role}-${stamp}@example.test`,
        password,
        email_confirm: true,
      });
      if (error !== null) throw new Error(`could not create ${role}: ${error.message}`);

      const id = data.user.id;
      userIds.push(id);

      // The trigger starts everybody at reader; the grant is the thing being
      // set up, not the thing being tested.
      if (role !== "reader") {
        const { error: grant } = await service.from("profiles").update({ role }).eq("user_id", id);
        if (grant !== null) throw new Error(`could not grant ${role}: ${grant.message}`);
      }

      const client = createClient(url, anonKey, { auth: { persistSession: false } });
      const { error: signIn } = await client.auth.signInWithPassword({
        email: data.user.email ?? "",
        password,
      });
      if (signIn !== null) throw new Error(`could not sign in as ${role}: ${signIn.message}`);

      clients.set(role, client);

      const { data: profile } = await service
        .from("profiles")
        .select("id")
        .eq("user_id", id)
        .single();
      profileIds.set(role, (profile as { id: string }).id);
    }
  });

  afterAll(async () => {
    await service
      .from("posts")
      .delete()
      .in("author_id", [...profileIds.values()]);
    for (const id of userIds) await service.auth.admin.deleteUser(id);
    // Deleting an account leaves a tombstone by design (E16.10). These are test
    // rows and nothing references them, so they go too — otherwise every run
    // adds four more "Deleted member" profiles to a developer's database.
    await service.from("profiles").delete().in("id", userIds);

    const { data: now } = await service.from("players").select("id");
    const strays = (now ?? [])
      .map((row) => row.id as string)
      .filter((id) => !playersBefore.includes(id));
    if (strays.length > 0) await service.from("players").delete().in("id", strays);
  });

  function as(role: UserRole): SupabaseClient {
    const client = clients.get(role);
    if (client === undefined) throw new Error(`no client for ${role}`);
    return client;
  }

  /**
   * Try to write, and report only whether a *policy* stopped it.
   *
   * A not-null or foreign-key complaint means the policy let the statement
   * through and the row was simply wrong, which is exactly what we want to
   * distinguish. Testing the policy this way means not having to build a valid
   * row for two dozen tables whose columns are not what is under test.
   */
  async function writeRefused(client: SupabaseClient, table: string): Promise<boolean> {
    // **No `.select()` here, deliberately.** Asking for the row back adds a
    // `RETURNING`, and with one Postgres evaluates the policy *before* the
    // not-null constraint instead of after — so an organizer inserting `{}` into
    // `matches` comes back "violates row-level security" rather than "null value
    // in column tournament_id", and the probe would report a refusal that never
    // happened. Anything the probe does manage to create is cleaned up in
    // `afterAll` instead.
    const { error } = await client.from(table).insert({});
    return error?.code === RLS_REFUSED;
  }

  describe("reads", () => {
    const PUBLIC_TABLES = [
      "profiles",
      "posts",
      "decks",
      "tournaments",
      "matches",
      "players",
      "player_identities",
      "player_ratings",
      "rating_events",
      "rating_config",
      "archetypes",
      "archetype_aliases",
      "archetype_stats",
      "card_stats",
      "matchup_stats",
      "format_versions",
      "format_legal_sets",
      "format_card_rules",
      "format_constraints",
      "seasons",
      "external_events",
      "tournament_entries",
      "match_corrections",
    ] as const;

    it.each(PUBLIC_TABLES)("lets a signed-out visitor read %s", async (table) => {
      const { error } = await anon.from(table).select("*").limit(1);
      expect(error).toBeNull();
    });

    /**
     * Private tables, checked against rows that actually exist.
     *
     * Row count alone cannot tell a policy that hides everything from a table
     * that is simply empty, so this uses `external_event_syncs` — which the
     * migrations populate, so there is always something there to fail to see.
     */
    it("hides the calendar request budget from everyone but the server", async () => {
      const { data: real } = await service.from("external_event_syncs").select("source");
      expect((real ?? []).length).toBeGreaterThan(0);

      for (const client of [anon, as("reader"), as("admin")]) {
        const { data, error } = await client.from("external_event_syncs").select("source");
        expect(error).toBeNull();
        expect(data).toStrictEqual([]);
      }
    });

    it.each(["merge_suggestions", "player_merges", "identity_exclusions"] as const)(
      "keeps %s away from anon and from a reader",
      async (table) => {
        for (const client of [anon, as("reader")]) {
          const { data, error } = await client.from(table).select("*");
          expect(error).toBeNull();
          expect(data).toStrictEqual([]);
        }
      },
    );

    it.each(["result_imports", "staged_matches"] as const)(
      "keeps the half-parsed %s away from readers",
      async (table) => {
        for (const client of [anon, as("reader"), as("writer")]) {
          const { data, error } = await client.from(table).select("*");
          expect(error).toBeNull();
          expect(data).toStrictEqual([]);
        }
      },
    );
  });

  describe("writes nobody may make", () => {
    /**
     * ADR 008: a derived statistic is never uploaded. These are recomputed
     * wholesale by a job running as service-role, which bypasses RLS — so a
     * policy here would be a way to upload one.
     */
    const DERIVED = [
      "archetype_stats",
      "card_stats",
      "matchup_stats",
      "deck_metrics",
      "deck_similarity",
      "deck_map_layout",
      "player_ratings",
      "rating_events",
      "rating_runs",
    ] as const;

    it.each(DERIVED)("refuses %s to an admin, the highest role there is", async (table) => {
      expect(await writeRefused(as("admin"), table)).toBe(true);
    });

    it.each(DERIVED)("refuses %s to a signed-out visitor", async (table) => {
      expect(await writeRefused(anon, table)).toBe(true);
    });

    it("refuses the calendar ledger to everybody", async () => {
      expect(await writeRefused(anon, "external_event_syncs")).toBe(true);
      expect(await writeRefused(as("admin"), "external_event_syncs")).toBe(true);
    });

    /** Their write paths are E20.2 and E20.7; until those land, nobody writes. */
    it.each(["post_revisions", "decks"] as const)(
      "refuses %s until its own story adds a policy",
      async (table) => {
        expect(await writeRefused(as("admin"), table)).toBe(true);
      },
    );
  });

  /**
   * E14.6. Real rows rather than the empty-insert probe: `posts` has not-null
   * columns with no default, so `{}` would fail on a constraint and say nothing
   * about the policy.
   */
  describe("post submission", () => {
    async function submit(
      client: SupabaseClient,
      author: UserRole,
      status: "review" | "published",
      kind: "community" | "official" = "community",
    ): Promise<string | null> {
      const { error } = await client.from("posts").insert({
        slug: `rls-${author}-${status}-${kind}-${Date.now()}-${Math.random()}`,
        title: "RLS probe",
        status,
        kind,
        author_id: profileIds.get(author),
      });
      return error?.code ?? null;
    }

    it("lets every rung submit for review", async () => {
      for (const role of ROLES) expect(await submit(as(role), role, "review")).toBeNull();
    });

    it("refuses a reader who publishes directly", async () => {
      expect(await submit(as("reader"), "reader", "published")).toBe(RLS_REFUSED);
    });

    it.each(["writer", "organizer", "admin"] as const)(
      "lets a %s publish directly",
      async (role) => {
        expect(await submit(as(role), role, "published")).toBeNull();
      },
    );

    it("refuses a post under somebody else's name", async () => {
      expect(await submit(as("writer"), "reader", "review")).toBe(RLS_REFUSED);
    });

    it("keeps the format's own voice to admins", async () => {
      expect(await submit(as("organizer"), "organizer", "published", "official")).toBe(RLS_REFUSED);
      expect(await submit(as("admin"), "admin", "published", "official")).toBeNull();
    });

    it("refuses a signed-out visitor", async () => {
      expect(await submit(anon, "reader", "review")).toBe(RLS_REFUSED);
    });

    it("keeps review_post from readers and from anon", async () => {
      const args = { post_id: "00000000-0000-0000-0000-000000000000", outcome: "published" };
      expect((await as("reader").rpc("review_post", args)).error?.code).toBe(RLS_REFUSED);
      expect((await anon.rpc("review_post", args)).error).not.toBeNull();
      expect((await as("writer").rpc("review_post", args)).data).toBe(false);
    });
  });

  describe("organizer-gated writes", () => {
    const ORGANIZER_TABLES = [
      "tournaments",
      "result_imports",
      "staged_matches",
      "players",
      "player_identities",
    ] as const;

    it.each(ORGANIZER_TABLES)("refuses %s to a reader", async (table) => {
      expect(await writeRefused(as("reader"), table)).toBe(true);
    });

    it.each(ORGANIZER_TABLES)("refuses %s to a writer", async (table) => {
      expect(await writeRefused(as("writer"), table)).toBe(true);
    });

    it.each(ORGANIZER_TABLES)("refuses %s to a signed-out visitor", async (table) => {
      expect(await writeRefused(anon, table)).toBe(true);
    });

    it.each(ORGANIZER_TABLES)("lets an organizer past the policy on %s", async (table) => {
      // Not `false` by accident: the insert still fails, on a not-null or a
      // foreign key. What matters is that it is no longer the policy refusing.
      expect(await writeRefused(as("organizer"), table)).toBe(false);
    });

    it.each(ORGANIZER_TABLES)("lets an admin past the policy on %s too", async (table) => {
      expect(await writeRefused(as("admin"), table)).toBe(false);
    });

    it("lets an organizer append to the ledger but never delete from it", async () => {
      expect(await writeRefused(as("organizer"), "matches")).toBe(false);

      // ADR 004 and 006: re-importing supersedes wholesale, as service-role. An
      // organizer who could delete a match by hand could quietly move a rating.
      const { error } = await as("organizer")
        .from("matches")
        .delete()
        .eq("id", "00000000-0000-0000-0000-000000000000");
      // No policy grants delete, so the statement matches nothing at all.
      expect(error).toBeNull();
    });
  });

  describe("admin-only writes", () => {
    const ADMIN_TABLES = [
      "format_versions",
      "format_legal_sets",
      "format_card_rules",
      "format_constraints",
      "seasons",
      "archetypes",
      "archetype_aliases",
      "rating_config",
      "merge_suggestions",
      "player_merges",
      "identity_exclusions",
    ] as const;

    it.each(ADMIN_TABLES)("refuses %s to an organizer", async (table) => {
      expect(await writeRefused(as("organizer"), table)).toBe(true);
    });

    it.each(ADMIN_TABLES)("refuses %s to a signed-out visitor", async (table) => {
      expect(await writeRefused(anon, table)).toBe(true);
    });

    it.each(ADMIN_TABLES)("lets an admin past the policy on %s", async (table) => {
      expect(await writeRefused(as("admin"), table)).toBe(false);
    });
  });

  describe("role grants", () => {
    it("lets an admin promote somebody", async () => {
      const { data: target } = await service
        .from("profiles")
        .select("id")
        .eq("role", "reader")
        .limit(1)
        .single();

      const { error } = await as("admin")
        .from("profiles")
        .update({ role: "writer" })
        .eq("id", target?.id);
      expect(error).toBeNull();

      // Put it back: other suites read these rows.
      await service.from("profiles").update({ role: "reader" }).eq("id", target?.id);
    });

    it("refuses to let an organizer promote anybody, including themselves", async () => {
      const organizer = as("organizer");
      const { data: me } = await organizer.auth.getUser();

      const { error } = await organizer
        .from("profiles")
        .update({ role: "admin" })
        .eq("user_id", me.user?.id ?? "");

      expect(error?.code).toBe(RLS_REFUSED);
    });

    it("refuses to let an admin demote themselves", async () => {
      const admin = as("admin");
      const { data: me } = await admin.auth.getUser();

      // The self-update policy is the only one that matches an admin's own row,
      // and it keeps `role` fixed — so the site can never lose its last admin.
      const { error } = await admin
        .from("profiles")
        .update({ role: "reader" })
        .eq("user_id", me.user?.id ?? "");

      expect(error?.code).toBe(RLS_REFUSED);
    });

    it("refuses to let a reader promote themselves", async () => {
      const reader = as("reader");
      const { data: me } = await reader.auth.getUser();

      const { error } = await reader
        .from("profiles")
        .update({ role: "organizer" })
        .eq("user_id", me.user?.id ?? "");

      expect(error?.code).toBe(RLS_REFUSED);
    });
  });

  describe("post reactions", () => {
    async function postId(slug: string): Promise<string> {
      const { data } = await service.from("posts").select("id").eq("slug", slug).single();
      return (data as { id: string }).id;
    }

    afterAll(async () => {
      await service
        .from("post_reactions")
        .delete()
        .in("profile_id", [...profileIds.values()]);
    });

    it("lets a member react, shows them only their own, and counts for everyone", async () => {
      const post = await postId("the-hub-is-live");
      const reader = profileIds.get("reader");
      const writer = profileIds.get("writer");

      expect(
        (
          await as("reader")
            .from("post_reactions")
            .insert({ post_id: post, profile_id: reader, reaction: "red" })
        ).error,
      ).toBeNull();
      expect(
        (
          await as("writer")
            .from("post_reactions")
            .insert({ post_id: post, profile_id: writer, reaction: "red" })
        ).error,
      ).toBeNull();

      const { data: seen } = await as("writer").from("post_reactions").select("profile_id");
      expect(seen).toStrictEqual([{ profile_id: writer }]);
      expect((await anon.from("post_reactions").select("*")).data).toStrictEqual([]);

      const { data: counts } = await anon.rpc("post_reaction_counts", { p_post_id: post });
      const red = (counts as { reaction: string; total: number }[]).find(
        (row) => row.reaction === "red",
      );
      expect(Number(red?.total)).toBeGreaterThanOrEqual(2);
    });

    it("refuses a reaction on a draft, or in somebody else's name", async () => {
      const draft = await postId("season-iii-predictions");
      const published = await postId("the-hub-is-live");

      const onDraft = await as("organizer")
        .from("post_reactions")
        .insert({ post_id: draft, profile_id: profileIds.get("organizer"), reaction: "blue" });
      expect(onDraft.error?.code).toBe(RLS_REFUSED);

      const forged = await as("organizer")
        .from("post_reactions")
        .insert({ post_id: published, profile_id: profileIds.get("admin"), reaction: "blue" });
      expect(forged.error?.code).toBe(RLS_REFUSED);
    });

    it("refuses a banned member", async () => {
      const organizer = profileIds.get("organizer") ?? "";
      await service
        .from("profiles")
        .update({ banned_at: new Date().toISOString() })
        .eq("id", organizer);
      try {
        const { error } = await as("organizer")
          .from("post_reactions")
          .insert({
            post_id: await postId("the-hub-is-live"),
            profile_id: organizer,
            reaction: "green",
          });
        expect(error?.code).toBe(RLS_REFUSED);
      } finally {
        await service.from("profiles").update({ banned_at: null }).eq("id", organizer);
      }
    });
  });

  describe("member history", () => {
    const stamp = `history-${Date.now()}`;
    const reader = () => profileIds.get("reader") ?? "";

    async function savedDeck(name: string, parent: string | null = null): Promise<string> {
      const { data, error } = await service
        .from("decks")
        .insert({
          name: `${stamp}-${name}`,
          owner_id: reader(),
          submitted_via: "import",
          visibility: "private",
          parent_deck_id: parent,
        })
        .select("id")
        .single();
      if (error !== null) throw new Error(error.message);
      return (data as { id: string }).id;
    }

    async function draftPost(): Promise<string> {
      const { data, error } = await service
        .from("posts")
        .insert({ slug: `${stamp}-${Math.random()}`, title: "Draft", author_id: reader() })
        .select("id")
        .single();
      if (error !== null) throw new Error(error.message);
      return (data as { id: string }).id;
    }

    afterAll(async () => {
      const { data: events } = await service
        .from("tournaments")
        .select("id")
        .like("slug", `${stamp}%`);
      const eventIds = (events ?? []).map((row) => row.id as string);
      await service.from("tournament_entries").delete().in("tournament_id", eventIds);
      await service.from("tournaments").delete().in("id", eventIds);
      await service.from("players").delete().like("slug", `${stamp}%`);
      await service.from("decks").update({ parent_deck_id: null }).like("name", `${stamp}%`);
      await service.from("decks").delete().like("name", `${stamp}%`);
    });

    it("shows an admin a member's drafts and private decks, and nobody below admin", async () => {
      const post = await draftPost();
      const deck = await savedDeck("private");

      for (const [role, sees] of [
        ["writer", false],
        ["organizer", false],
        ["admin", true],
      ] as const) {
        const posts = await as(role).from("posts").select("id").eq("id", post);
        const decks = await as(role).from("decks").select("id").eq("id", deck);
        expect({ role, posts: posts.data?.length, decks: decks.data?.length }).toStrictEqual({
          role,
          posts: sees ? 1 : 0,
          decks: sees ? 1 : 0,
        });
      }
    });

    it("lets only an admin delete somebody's post", async () => {
      const post = await draftPost();

      const refused = await as("organizer").rpc("admin_delete_post", { p_post_id: post });
      expect(refused.error?.code).toBe(RLS_REFUSED);

      expect((await as("admin").rpc("admin_delete_post", { p_post_id: post })).error).toBeNull();
      expect((await service.from("posts").select("id").eq("id", post)).data).toStrictEqual([]);
    });

    it("deletes every version of a saved deck, or hides them all when an event names one", async () => {
      const first = await savedDeck("v1");
      const second = await savedDeck("v2", first);
      const removed = await as("admin").rpc("admin_remove_deck", { p_deck_id: second });
      expect(removed.data).toBe("deleted");
      expect(
        (await service.from("decks").select("id").in("id", [first, second])).data,
      ).toStrictEqual([]);

      const played = await savedDeck("played");
      const next = await savedDeck("played-v2", played);
      const { data: player } = await service
        .from("players")
        .insert({ display_name: "History test", slug: `${stamp}-player` })
        .select("id")
        .single();
      const { data: event } = await service
        .from("tournaments")
        .insert({ name: "History test", slug: `${stamp}-event`, event_date: "2026-09-01" })
        .select("id")
        .single();
      await service.from("tournament_entries").insert({
        tournament_id: (event as { id: string }).id,
        player_id: (player as { id: string }).id,
        deck_id: played,
        dropped: true,
      });

      const hidden = await as("admin").rpc("admin_remove_deck", { p_deck_id: next });
      expect(hidden.data).toBe("hidden");
      const { data: rows } = await service
        .from("decks")
        .select("hidden_at")
        .in("id", [played, next]);
      expect(rows?.every((row) => row.hidden_at !== null)).toBe(true);
    });

    it("removes everything a member made at once, but never the admin's own", async () => {
      await draftPost();
      await savedDeck("bulk");

      const own = await as("admin").rpc("admin_remove_member_content", {
        p_profile_id: profileIds.get("admin"),
      });
      expect(own.error?.code).toBe(RLS_REFUSED);

      const { data, error } = await as("admin")
        .rpc("admin_remove_member_content", { p_profile_id: reader() })
        .single();
      expect(error).toBeNull();
      expect((data as { posts_deleted: number }).posts_deleted).toBeGreaterThan(0);
      expect(
        (await service.from("posts").select("id").eq("author_id", reader())).data,
      ).toStrictEqual([]);
    });
  });

  describe("the ladder, as the database sees it", () => {
    it("agrees with core/auth/meets-role on all sixteen pairs", async () => {
      expect(LADDER).toHaveLength(ROLES.length ** 2);

      for (const pair of LADDER) {
        const { data, error } = await as(pair.actual).rpc("has_role", {
          required: pair.required,
        });

        expect(error).toBeNull();
        expect({ ...pair, got: data }).toStrictEqual({ ...pair, got: pair.meets });
      }
    });

    it("says no to a signed-out caller for every rung", async () => {
      for (const required of ROLES) {
        const { data } = await anon.rpc("has_role", { required });
        // `anon` has no execute grant, so this is an error rather than `false`.
        // Either way it is not a yes, which is the property being asserted.
        expect(data ?? false).toBe(false);
      }
    });
  });
});
