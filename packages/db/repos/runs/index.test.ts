import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addRunGuest,
  confirmRunResult,
  createRun,
  deleteDraftRun,
  dropRunEntrant,
  getEntrantArenaUsername,
  getRun,
  listLiveRuns,
  listRunEntrants,
  listRunPairings,
  listRunResultChanges,
  listRunRounds,
  listRunsByOrganizer,
  postRunRound,
  registerForRun,
  removeRunEntrant,
  reportRunResult,
  setEntrantCheckedIn,
  setRunResult,
  setRunState,
  updateRun,
} from "./index";

/**
 * Runs against a local Supabase (`pnpm db:start`), as the people who would make each
 * call, so the policies in 0048–0051 are part of what is tested. Who may do what is
 * `rls-runs.test.ts`'s job; this one checks the functions say what they mean.
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

const reachable = await anon
  .from("profiles")
  .select("id")
  .limit(1)
  .then(({ error }) => error === null)
  .catch(() => false);

type Person = "organizer" | "alice" | "bob";

describe.skipIf(!reachable)("repos/runs", () => {
  const stamp = Date.now();
  const clients = new Map<Person, SupabaseClient>();
  const profiles = new Map<Person, string>();
  const userIds: string[] = [];
  const runIds: string[] = [];
  let formatVersionId = "";

  const as = (who: Person): SupabaseClient => {
    const client = clients.get(who);
    if (client === undefined) throw new Error(who);
    return client;
  };
  const profile = (who: Person): string => profiles.get(who) ?? "";
  const handle = (who: Person) => `runs-${who}-${stamp}`;

  beforeAll(async () => {
    for (const who of ["organizer", "alice", "bob"] as const) {
      const password = `repos-runs-${who}-${stamp}`;
      const { data, error } = await service.auth.admin.createUser({
        email: `repos-runs-${who}-${stamp}@example.test`,
        password,
        email_confirm: true,
      });
      if (error !== null) throw new Error(error.message);
      userIds.push(data.user.id);
      const { data: row } = await service
        .from("profiles")
        .update({ role: who === "organizer" ? "organizer" : "reader", handle: handle(who) })
        .eq("user_id", data.user.id)
        .select("id")
        .single();
      profiles.set(who, (row as { id: string }).id);
      const client = createClient(url, anonKey, { auth: { persistSession: false } });
      await client.auth.signInWithPassword({ email: data.user.email ?? "", password });
      clients.set(who, client);
    }
    const { data: version } = await service.from("format_versions").select("id").limit(1).single();
    formatVersionId = (version as { id: string } | null)?.id ?? "";
  });

  afterAll(async () => {
    if (runIds.length > 0) await service.from("tournament_runs").delete().in("id", runIds);
    for (const id of userIds) await service.auth.admin.deleteUser(id);
    await service.from("profiles").delete().in("id", userIds);
  });

  it("creates a draft with its formats, edits it, and deletes it", async () => {
    const run = await createRun(
      as("organizer"),
      profile("organizer"),
      { name: "Scratch", startsAt: null, description: null, swissRounds: 3, topCut: 0 },
      formatVersionId === "" ? [] : [formatVersionId],
    );
    runIds.push(run.id);
    expect(run).toMatchObject({
      name: "Scratch",
      state: "draft",
      organizerId: profile("organizer"),
      tournamentId: null,
      formatVersionIds: formatVersionId === "" ? [] : [formatVersionId],
    });

    await updateRun(as("organizer"), run.id, {
      name: "Scratch, renamed",
      startsAt: "2026-10-17T19:00:00.000Z",
      description: "Bo3",
      swissRounds: 4,
      topCut: 4,
    });
    expect(await getRun(as("organizer"), run.id)).toMatchObject({
      name: "Scratch, renamed",
      startsAt: "2026-10-17T19:00:00+00:00",
      swissRounds: 4,
      topCut: 4,
    });
    expect(await getRun(anon, run.id)).toBeNull();
    expect(
      (await listRunsByOrganizer(as("organizer"), profile("organizer"))).map((r) => r.id),
    ).toContain(run.id);

    await deleteDraftRun(as("organizer"), run.id);
    expect(await getRun(as("organizer"), run.id)).toBeNull();
  });

  it("plays a round through: register, pair, report, confirm, overrule", async () => {
    const organizer = as("organizer");
    const run = await createRun(
      organizer,
      profile("organizer"),
      { name: "Weekly", startsAt: null, description: null, swissRounds: 2, topCut: 0 },
      [],
    );
    runIds.push(run.id);
    await setRunState(organizer, run.id, "registration");
    expect((await listLiveRuns(anon)).map((r) => r.id)).toContain(run.id);

    const alice = await registerForRun(as("alice"), run.id, {
      profileId: profile("alice"),
      displayName: "Alice",
      handle: handle("alice"),
    });
    const bob = await registerForRun(as("bob"), run.id, {
      profileId: profile("bob"),
      displayName: "Bob",
      handle: handle("bob"),
    });
    const guest = await addRunGuest(organizer, run.id, {
      displayName: "Walk-in Sam",
      arenaUsername: "WalkInSam#12345",
    });
    const late = await addRunGuest(organizer, run.id, {
      displayName: "Never came",
      arenaUsername: null,
    });
    await removeRunEntrant(organizer, late.id);

    for (const entrant of [alice, bob, guest])
      await setEntrantCheckedIn(organizer, entrant.id, true);
    expect((await listRunEntrants(anon, run.id)).map((e) => [e.displayName, e.checkedIn])).toEqual([
      ["Alice", true],
      ["Bob", true],
      ["Walk-in Sam", true],
    ]);
    await setRunState(organizer, run.id, "running");

    await postRunRound(organizer, run.id, { number: 1, kind: "swiss" }, [
      { table: 1, p1EntrantId: alice.id, p2EntrantId: guest.id },
      { table: 2, p1EntrantId: bob.id, p2EntrantId: null },
    ]);
    // A re-pair before any result replaces the round whole.
    await postRunRound(organizer, run.id, { number: 1, kind: "swiss" }, [
      { table: 1, p1EntrantId: alice.id, p2EntrantId: bob.id },
      { table: 2, p1EntrantId: guest.id, p2EntrantId: null },
    ]);
    expect(await listRunRounds(anon, run.id)).toMatchObject([{ number: 1, kind: "swiss" }]);

    const [match, bye] = await listRunPairings(anon, run.id);
    expect(match).toMatchObject({ round: 1, table: 1, p2EntrantId: bob.id, status: "pending" });
    expect(bye).toMatchObject({
      round: 1,
      p1EntrantId: guest.id,
      p2EntrantId: null,
      status: "confirmed",
    });

    expect(await getEntrantArenaUsername(as("alice"), guest)).toBeNull();
    expect(await getEntrantArenaUsername(organizer, guest)).toBe("WalkInSam#12345");

    await reportRunResult(as("alice"), match?.id ?? "", { p1Wins: 2, p2Wins: 1, draws: 0 });
    expect((await listRunPairings(anon, run.id))[0]).toMatchObject({
      status: "reported",
      reportedBy: profile("alice"),
      games: { p1Wins: 2, p2Wins: 1, draws: 0 },
    });
    await expect(confirmRunResult(as("alice"), match?.id ?? "")).rejects.toThrow(/42501/);
    await confirmRunResult(as("bob"), match?.id ?? "");
    await setRunResult(organizer, match?.id ?? "", { p1Wins: 1, p2Wins: 2, draws: 0 });

    expect((await listRunPairings(anon, run.id))[0]).toMatchObject({
      status: "confirmed",
      games: { p1Wins: 1, p2Wins: 2, draws: 0 },
    });
    const changes = await listRunResultChanges(organizer, match?.id ?? "");
    expect(changes.map((c) => [c.changedBy, c.after.status])).toEqual([
      [profile("alice"), "reported"],
      [profile("bob"), "confirmed"],
      [profile("organizer"), "confirmed"],
    ]);
    expect(changes[0]?.before).toEqual({ games: null, status: "pending" });

    await expect(postRunRound(organizer, run.id, { number: 1, kind: "swiss" }, [])).rejects.toThrow(
      /cannot be re-paired/,
    );

    await dropRunEntrant(organizer, guest.id, 1);
    expect(
      (await listRunEntrants(anon, run.id)).find((e) => e.id === guest.id)?.droppedAfterRound,
    ).toBe(1);
  });
});
