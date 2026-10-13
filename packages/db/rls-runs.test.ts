import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * E26.13 — the allow-deny matrix for running events on the site (§28). **A release
 * blocker when red**, like `rls.test.ts`, which it extends to the run tables.
 *
 * Beyond the five site roles, a run adds two: an entrant, and the other player in
 * their pairing. One run is played through in order — draft, registration, a round,
 * a result reported, confirmed and overruled — because most of these rules depend
 * on where the run is.
 *
 * Skipped rather than failed when nothing is listening, like every suite here.
 */
const url = process.env["SUPABASE_URL"] ?? "http://127.0.0.1:54321";
const anonKey =
  process.env["SUPABASE_ANON_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
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

/** A policy, a column grant, and the result guard all refuse with this. */
const REFUSED = "42501";

type Person = "alice" | "bob" | "carol" | "writer" | "organizer" | "rival" | "admin";

const ROLE: Record<Person, "reader" | "writer" | "organizer" | "admin"> = {
  alice: "reader",
  bob: "reader",
  carol: "reader",
  writer: "writer",
  organizer: "organizer",
  rival: "organizer",
  admin: "admin",
};

describe.skipIf(!online)("RLS — running events on the site", () => {
  const stamp = Date.now();
  const clients = new Map<Person, SupabaseClient>();
  const profiles = new Map<Person, string>();
  const userIds: string[] = [];
  const handleOf = (who: Person) => `rls-${who}-${stamp}`;

  let runId = "";
  const entrant = new Map<string, string>();
  let roundId = "";
  let pairingId = "";

  function as(who: Person): SupabaseClient {
    const client = clients.get(who);
    if (client === undefined) throw new Error(`no client for ${who}`);
    return client;
  }

  async function visibleRuns(client: SupabaseClient): Promise<number> {
    const { data, error } = await client.from("tournament_runs").select("id").eq("id", runId);
    expect(error).toBeNull();
    return (data ?? []).length;
  }

  async function register(who: Person, as_: Person = who) {
    return as(as_)
      .from("run_entrants")
      .insert({
        run_id: runId,
        profile_id: profiles.get(who),
        display_name: who,
        handle: handleOf(who),
      })
      .select("id")
      .maybeSingle();
  }

  async function pairing() {
    const { data } = await service.from("run_pairings").select("*").eq("id", pairingId).single();
    return data as {
      status: string;
      p1_wins: number | null;
      reported_by: string | null;
      confirmed_by: string | null;
    };
  }

  beforeAll(async () => {
    for (const who of Object.keys(ROLE) as Person[]) {
      const password = `rls-runs-${who}-${stamp}`;
      const { data, error } = await service.auth.admin.createUser({
        email: `rls-runs-${who}-${stamp}@example.test`,
        password,
        email_confirm: true,
      });
      if (error !== null) throw new Error(`could not create ${who}: ${error.message}`);
      userIds.push(data.user.id);

      const { data: profile, error: update } = await service
        .from("profiles")
        .update({ role: ROLE[who], handle: handleOf(who) })
        .eq("user_id", data.user.id)
        .select("id")
        .single();
      if (update !== null) throw new Error(`could not set up ${who}: ${update.message}`);
      profiles.set(who, (profile as { id: string }).id);

      const client = createClient(url, anonKey, { auth: { persistSession: false } });
      const { error: signIn } = await client.auth.signInWithPassword({
        email: data.user.email ?? "",
        password,
      });
      if (signIn !== null) throw new Error(`could not sign in as ${who}: ${signIn.message}`);
      clients.set(who, client);
    }
  });

  afterAll(async () => {
    if (runId !== "") await service.from("tournament_runs").delete().eq("id", runId);
    for (const id of userIds) await service.auth.admin.deleteUser(id);
    await service.from("profiles").delete().in("id", userIds);
  });

  describe("a draft", () => {
    it("is created by an organizer under their own name, and nobody below", async () => {
      for (const who of ["alice", "writer"] as const) {
        const { error } = await as(who)
          .from("tournament_runs")
          .insert({ name: "RLS run", organizer_id: profiles.get(who) });
        expect(error?.code).toBe(REFUSED);
      }
      const forged = await as("organizer")
        .from("tournament_runs")
        .insert({ name: "RLS run", organizer_id: profiles.get("rival") });
      expect(forged.error?.code).toBe(REFUSED);

      const { data, error } = await as("organizer")
        .from("tournament_runs")
        .insert({ name: "RLS run", organizer_id: profiles.get("organizer"), swiss_rounds: 3 })
        .select("id, state, seed")
        .single();
      expect(error).toBeNull();
      runId = (data as { id: string }).id;
      expect(data).toMatchObject({ state: "draft" });
      expect((data as { seed: string }).seed).toMatch(/^[0-9a-f]{16}$/);
    });

    it("is visible to its organizer and admins only", async () => {
      expect(await visibleRuns(anon)).toBe(0);
      expect(await visibleRuns(as("alice"))).toBe(0);
      expect(await visibleRuns(as("rival"))).toBe(0);
      expect(await visibleRuns(as("organizer"))).toBe(1);
      expect(await visibleRuns(as("admin"))).toBe(1);
    });

    it("keeps the seed and the tournament link out of everyone's hands", async () => {
      for (const column of [{ seed: "chosen" }, { tournament_id: null }]) {
        const { error } = await as("organizer")
          .from("tournament_runs")
          .update(column)
          .eq("id", runId);
        expect(error?.code).toBe(REFUSED);
      }
    });

    it("is changed by its organizer or an admin, not another organizer", async () => {
      await as("rival").from("tournament_runs").update({ name: "Hijacked" }).eq("id", runId);
      const { data } = await service
        .from("tournament_runs")
        .select("name")
        .eq("id", runId)
        .single();
      expect(data).toEqual({ name: "RLS run" });

      const { error } = await as("admin")
        .from("tournament_runs")
        .update({ description: "Checked by an admin" })
        .eq("id", runId);
      expect(error).toBeNull();
    });

    it("takes no registrations", async () => {
      expect((await register("alice")).error?.code).toBe(REFUSED);
    });
  });

  describe("registration", () => {
    beforeAll(async () => {
      const { error } = await as("organizer")
        .from("tournament_runs")
        .update({ state: "registration" })
        .eq("id", runId);
      if (error !== null) throw new Error(error.message);
    });

    it("makes the run and its entrants public", async () => {
      expect(await visibleRuns(anon)).toBe(1);
      expect(await visibleRuns(as("rival"))).toBe(1);
    });

    it("lets a member register only themself, under their own handle", async () => {
      expect((await register("bob", "alice")).error?.code).toBe(REFUSED);

      const wrongHandle = await as("alice")
        .from("run_entrants")
        .insert({
          run_id: runId,
          profile_id: profiles.get("alice"),
          display_name: "alice",
          handle: handleOf("bob"),
        });
      expect(wrongHandle.error?.code).toBe(REFUSED);

      for (const who of ["alice", "bob", "carol"] as const) {
        const { data, error } = await register(who);
        expect(error).toBeNull();
        entrant.set(who, (data as { id: string }).id);
      }
      const { data } = await anon.from("run_entrants").select("id").eq("run_id", runId);
      expect(data).toHaveLength(3);
    });

    it("does not let a member check themself in", async () => {
      const { error } = await as("alice")
        .from("run_entrants")
        .update({ checked_in: true })
        .eq("id", entrant.get("alice") ?? "");
      const { data } = await service
        .from("run_entrants")
        .select("checked_in")
        .eq("id", entrant.get("alice") ?? "")
        .single();
      expect(error === null || error.code === REFUSED).toBe(true);
      expect(data).toEqual({ checked_in: false });
    });

    it("lets the organizer add a guest, whose Arena name only the organizer reads", async () => {
      const refused = await as("alice")
        .from("run_entrants")
        .insert({ run_id: runId, display_name: "Walk-in Sam" });
      expect(refused.error?.code).toBe(REFUSED);

      const { data, error } = await as("organizer")
        .from("run_entrants")
        .insert({ run_id: runId, display_name: "Walk-in Sam" })
        .select("id")
        .single();
      expect(error).toBeNull();
      entrant.set("guest", (data as { id: string }).id);

      const contact = await as("organizer")
        .from("run_guest_contacts")
        .insert({ entrant_id: entrant.get("guest"), arena_username: "WalkInSam#12345" });
      expect(contact.error).toBeNull();

      for (const client of [anon, as("alice"), as("rival")]) {
        const { data: seen } = await client.from("run_guest_contacts").select("*");
        expect(seen).toEqual([]);
      }
      const { data: own } = await as("organizer")
        .from("run_guest_contacts")
        .select("arena_username")
        .eq("entrant_id", entrant.get("guest") ?? "");
      expect(own).toEqual([{ arena_username: "WalkInSam#12345" }]);
    });

    it("refuses a guest contact for a member's entry", async () => {
      const { error } = await as("organizer")
        .from("run_guest_contacts")
        .insert({ entrant_id: entrant.get("alice"), arena_username: "Alice#1" });
      expect(error?.code).toBe(REFUSED);
    });
  });

  describe("a round being played", () => {
    beforeAll(async () => {
      const organizer = as("organizer");
      await organizer.from("run_entrants").update({ checked_in: true }).eq("run_id", runId);
      await organizer.from("tournament_runs").update({ state: "running" }).eq("id", runId);

      const { data: round, error } = await organizer
        .from("run_rounds")
        .insert({ run_id: runId, number: 1, kind: "swiss" })
        .select("id")
        .single();
      if (error !== null) throw new Error(error.message);
      roundId = (round as { id: string }).id;

      const { data: pairings, error: paired } = await organizer
        .from("run_pairings")
        .insert([
          {
            round_id: roundId,
            run_id: runId,
            table_number: 1,
            p1_entrant_id: entrant.get("alice"),
            p2_entrant_id: entrant.get("bob"),
          },
          {
            round_id: roundId,
            run_id: runId,
            table_number: 2,
            p1_entrant_id: entrant.get("carol"),
            p2_entrant_id: entrant.get("guest"),
          },
        ])
        .select("id, table_number");
      if (paired !== null) throw new Error(paired.message);
      pairingId =
        (pairings as Array<{ id: string; table_number: number }>).find((p) => p.table_number === 1)
          ?.id ?? "";
    });

    it("closes registration and withdrawal once the run has started", async () => {
      expect((await register("writer")).error?.code).toBe(REFUSED);

      await as("alice")
        .from("run_entrants")
        .delete()
        .eq("id", entrant.get("alice") ?? "");
      const { data } = await service.from("run_entrants").select("id").eq("run_id", runId);
      expect(data).toHaveLength(4);
    });

    it("lets only the organizer pair a round, and nobody twice in it", async () => {
      const { error } = await as("alice")
        .from("run_rounds")
        .insert({ run_id: runId, number: 2, kind: "swiss" });
      expect(error?.code).toBe(REFUSED);

      const twice = await as("organizer")
        .from("run_pairings")
        .insert({
          round_id: roundId,
          run_id: runId,
          table_number: 3,
          p1_entrant_id: entrant.get("alice"),
          p2_entrant_id: null,
        });
      expect(twice.error?.code).toBe("23505");
    });

    it("shows a guest's Arena name to their current opponent, and to nobody else", async () => {
      const { data: carol } = await as("carol").from("run_guest_contacts").select("arena_username");
      expect(carol).toEqual([{ arena_username: "WalkInSam#12345" }]);
      const { data: alice } = await as("alice").from("run_guest_contacts").select("arena_username");
      expect(alice).toEqual([]);
    });

    it("takes a report from either player, and a confirmation only from the other", async () => {
      const report = await as("alice")
        .from("run_pairings")
        .update({ p1_wins: 2, p2_wins: 1, draws: 0 })
        .eq("id", pairingId);
      expect(report.error).toBeNull();
      expect(await pairing()).toMatchObject({
        status: "reported",
        p1_wins: 2,
        reported_by: profiles.get("alice"),
      });

      const selfConfirm = await as("alice")
        .from("run_pairings")
        .update({ status: "confirmed" })
        .eq("id", pairingId);
      expect(selfConfirm.error?.code).toBe(REFUSED);

      await as("carol").from("run_pairings").update({ status: "confirmed" }).eq("id", pairingId);
      expect((await pairing()).status).toBe("reported");

      const confirm = await as("bob")
        .from("run_pairings")
        .update({ status: "confirmed" })
        .eq("id", pairingId);
      expect(confirm.error).toBeNull();
      expect(await pairing()).toMatchObject({
        status: "confirmed",
        confirmed_by: profiles.get("bob"),
      });
    });

    it("leaves a confirmed result to the organizer, who can overrule it", async () => {
      const late = await as("bob")
        .from("run_pairings")
        .update({ p1_wins: 1, p2_wins: 2 })
        .eq("id", pairingId);
      expect(late.error?.code).toBe(REFUSED);

      const overrule = await as("organizer")
        .from("run_pairings")
        .update({ p1_wins: 0, p2_wins: 0, draws: 3 })
        .eq("id", pairingId);
      expect(overrule.error).toBeNull();
      expect(await pairing()).toMatchObject({ status: "confirmed", p1_wins: 0 });
    });

    it("logs every change with who made it, for the organizer's eyes", async () => {
      const { data } = await as("organizer")
        .from("run_result_changes")
        .select("changed_by, after")
        .eq("pairing_id", pairingId)
        .order("created_at");
      expect((data ?? []).map((row) => row.changed_by)).toEqual([
        profiles.get("alice"),
        profiles.get("bob"),
        profiles.get("organizer"),
      ]);

      const { data: hidden } = await as("alice").from("run_result_changes").select("id");
      expect(hidden).toEqual([]);
    });

    it("will not replace a round that has a result in it", async () => {
      await as("organizer").from("run_rounds").delete().eq("id", roundId);
      const { data } = await service.from("run_rounds").select("id").eq("id", roundId);
      expect(data).toHaveLength(1);
    });

    it("confirms a bye on the spot, and refuses a drawn top cut match", async () => {
      const organizer = as("organizer");
      const { data: round } = await organizer
        .from("run_rounds")
        .insert({ run_id: runId, number: 2, kind: "elimination" })
        .select("id")
        .single();
      const cutRound = (round as { id: string }).id;

      const { data: rows } = await organizer
        .from("run_pairings")
        .insert([
          {
            round_id: cutRound,
            run_id: runId,
            table_number: 1,
            p1_entrant_id: entrant.get("alice"),
            p2_entrant_id: entrant.get("carol"),
          },
          { round_id: cutRound, run_id: runId, table_number: 2, p1_entrant_id: entrant.get("bob") },
        ])
        .select("id, status, table_number");
      const [match, bye] = [
        ...((rows ?? []) as Array<{ id: string; status: string; table_number: number }>),
      ].sort((a, b) => a.table_number - b.table_number);
      expect(bye?.status).toBe("confirmed");

      const draw = await organizer
        .from("run_pairings")
        .update({ p1_wins: 1, p2_wins: 1, draws: 1 })
        .eq("id", match?.id ?? "");
      expect(draw.error?.code).toBe("23514");
    });
  });
});
