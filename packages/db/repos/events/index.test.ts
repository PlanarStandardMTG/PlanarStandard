import type { EventSource } from "@ps/contracts";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  claimCompletions,
  claimSyncWindow,
  getSyncState,
  listAllCachedEvents,
  listCachedEvents,
  listCompletions,
  markCompletionFailed,
  markCompletionProcessed,
  recordCompletions,
  recordSyncResult,
  requeueAllCompletions,
  replaceEvents,
} from "./index";

/**
 * Runs against a local Supabase with the seed loaded (`pnpm db:reset`).
 *
 * Skipped rather than failed when nothing is listening, for the same reason as
 * `repos/content`: `db` is the one package allowed to need infrastructure, and
 * the zero-credential promise only holds if a missing instance is a skip.
 *
 * These tests write, so they run against a source of their own rather than
 * against `challonge`. That keeps a developer's seeded `/events` intact after
 * `pnpm test` — and it is the more honest test besides, since every query here
 * claims to be scoped to one source and this is what proves it.
 */
const url = process.env["SUPABASE_URL"] ?? "http://127.0.0.1:54321";
const anonKey =
  process.env["SUPABASE_ANON_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
/**
 * Deliberately its own variable rather than the production service-role one.
 * That name belongs to server-only modules and `scripts/check-server-only.ts`
 * (E1.7) fails CI on any other file that mentions it — and this suite deletes
 * every row in `external_events`, so inheriting an ambient production key is a
 * failure mode worth making impossible. The default is the Supabase CLI's
 * published demo key, the same one in `apps/web/.env.example`.
 */
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

/**
 * Cast because `EventSource` names the calendars the site actually caches.
 * Widening the union so a test can have its own value would put a fictional
 * source in the contract, which is the worse trade.
 */
const TEST_SOURCE = "vitest" as EventSource;

const event = (externalId: string, name: string) => ({
  source: TEST_SOURCE,
  externalId,
  name,
  url: `https://challonge.com/${externalId}`,
  state: "scheduled" as const,
  startsAt: "2026-10-01T18:00:00.000Z",
  participantCount: 8,
  structure: "swiss",
});

const FETCHED_AT = "2026-09-15T12:00:00.000Z";

async function resetTestSource(): Promise<void> {
  await service.from("event_completions").delete().eq("source", TEST_SOURCE);
  await service.from("external_events").delete().eq("source", TEST_SOURCE);
  await service.from("external_event_syncs").delete().eq("source", TEST_SOURCE);
  await service.from("external_event_syncs").insert({ source: TEST_SOURCE });
}

async function dropTestSource(): Promise<void> {
  await service.from("event_completions").delete().eq("source", TEST_SOURCE);
  await service.from("external_events").delete().eq("source", TEST_SOURCE);
  await service.from("external_event_syncs").delete().eq("source", TEST_SOURCE);
}

describe.skipIf(!reachable)("repos/events", () => {
  beforeEach(resetTestSource);
  afterAll(dropTestSource);

  it("reads back what was written, mapped to the contract", async () => {
    await replaceEvents(service, TEST_SOURCE, [event("1001", "Weekly #41")], FETCHED_AT);

    const [cached] = await listCachedEvents(client, TEST_SOURCE);

    expect(cached).toMatchObject({
      source: TEST_SOURCE,
      externalId: "1001",
      name: "Weekly #41",
      url: "https://challonge.com/1001",
      state: "scheduled",
      startsAt: "2026-10-01T18:00:00+00:00",
      participantCount: 8,
      structure: "swiss",
    });
    expect(cached?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("reads across every calendar at once, which is what a page asks for", async () => {
    await replaceEvents(service, TEST_SOURCE, [event("1001", "Weekly #41")], FETCHED_AT);

    const all = await listAllCachedEvents(client);
    const sources = new Set(all.map((e) => e.source));

    // This suite writes under a source of its own, and the seed holds two more,
    // so a set with one member would mean the query is still scoped somewhere.
    expect(all.map((e) => e.externalId)).toContain("1001");
    expect(sources.size).toBeGreaterThan(1);
  });

  it("supersedes wholesale — an event dropped from the payload leaves the cache", async () => {
    await replaceEvents(
      service,
      TEST_SOURCE,
      [event("1001", "Kept"), event("1002", "Cancelled")],
      FETCHED_AT,
    );
    await replaceEvents(service, TEST_SOURCE, [event("1001", "Kept")], FETCHED_AT);

    const ids = (await listCachedEvents(client, TEST_SOURCE)).map((e) => e.externalId);
    expect(ids).toEqual(["1001"]);
  });

  it("empties the cache when the calendar comes back empty", async () => {
    await replaceEvents(service, TEST_SOURCE, [event("1001", "Kept")], FETCHED_AT);
    await replaceEvents(service, TEST_SOURCE, [], FETCHED_AT);

    expect(await listCachedEvents(client, TEST_SOURCE)).toEqual([]);
  });

  it("updates an event in place rather than duplicating it", async () => {
    await replaceEvents(service, TEST_SOURCE, [event("1001", "Weekly #41")], FETCHED_AT);
    await replaceEvents(
      service,
      TEST_SOURCE,
      [{ ...event("1001", "Weekly #41"), state: "live" as const, participantCount: 24 }],
      "2026-09-15T14:00:00.000Z",
    );

    const cached = await listCachedEvents(client, TEST_SOURCE);
    expect(cached).toHaveLength(1);
    expect(cached[0]?.state).toBe("live");
    expect(cached[0]?.participantCount).toBe(24);
  });

  it("gives the claim to exactly one of two simultaneous callers", async () => {
    const cutoff = "2026-09-15T10:00:00.000Z";

    const claims = await Promise.all([
      claimSyncWindow(service, TEST_SOURCE, cutoff, FETCHED_AT),
      claimSyncWindow(service, TEST_SOURCE, cutoff, FETCHED_AT),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("refuses a second claim inside the window and allows one after it", async () => {
    await claimSyncWindow(service, TEST_SOURCE, "2026-09-15T10:00:00.000Z", FETCHED_AT);

    expect(
      await claimSyncWindow(service, TEST_SOURCE, "2026-09-15T10:00:00.000Z", FETCHED_AT),
    ).toBe(false);
    expect(
      await claimSyncWindow(service, TEST_SOURCE, "2026-09-15T13:00:00.000Z", FETCHED_AT),
    ).toBe(true);
  });

  it("spends the window on a failed refresh, and remembers why", async () => {
    await claimSyncWindow(service, TEST_SOURCE, "2026-09-15T10:00:00.000Z", FETCHED_AT);
    await recordSyncResult(service, TEST_SOURCE, { error: "challonge responded 429" });

    const state = await getSyncState(service, TEST_SOURCE);

    expect(state?.lastAttemptedAt).not.toBeNull();
    expect(state?.lastSucceededAt).toBeNull();
    expect(state?.lastError).toBe("challonge responded 429");
  });

  it("clears the last error once a refresh works", async () => {
    await recordSyncResult(service, TEST_SOURCE, { error: "challonge responded 429" });
    await recordSyncResult(service, TEST_SOURCE, { succeededAt: FETCHED_AT, eventCount: 7 });

    const state = await getSyncState(service, TEST_SOURCE);

    expect(state?.lastError).toBeNull();
    expect(state?.eventCount).toBe(7);
  });

  it("scopes every read and write to one source", async () => {
    await replaceEvents(service, TEST_SOURCE, [event("1001", "Mine")], FETCHED_AT);

    const seeded = await listCachedEvents(client, "challonge");
    const mine = await listCachedEvents(client, TEST_SOURCE);

    expect(mine.map((e) => e.externalId)).toEqual(["1001"]);
    expect(seeded.every((e) => e.source === "challonge")).toBe(true);
    expect(seeded.some((e) => e.externalId === "1001")).toBe(false);
  });

  it("keeps the sync ledger away from the public client", async () => {
    await expect(getSyncState(client, TEST_SOURCE)).resolves.toBeNull();
  });

  describe("the completion queue (E23.13)", () => {
    const NOW = "2026-09-25T12:00:00.000Z";
    const claim = (over: { leaseCutoff?: string; maxAttempts?: number } = {}) =>
      claimCompletions(service, {
        limit: 10,
        leaseCutoff: over.leaseCutoff ?? "2026-09-25T11:45:00.000Z",
        maxAttempts: over.maxAttempts ?? 5,
        source: TEST_SOURCE,
      });

    it("queues an event once, however many refreshes see it finish", async () => {
      await recordCompletions(service, TEST_SOURCE, [{ externalId: "9", name: "Finals" }], NOW);
      await recordCompletions(service, TEST_SOURCE, [{ externalId: "9", name: "Finals" }], NOW);

      const claimed = await claim();
      expect(claimed).toHaveLength(1);
      expect(claimed[0]).toMatchObject({ externalId: "9", name: "Finals", attempts: 1 });
    });

    it("gives a claimed row to nobody else until its lease runs out", async () => {
      await recordCompletions(service, TEST_SOURCE, [{ externalId: "9", name: "Finals" }], NOW);
      expect(await claim()).toHaveLength(1);

      // Held since just now: a cutoff an hour ago does not reach it.
      expect(await claim({ leaseCutoff: "2026-01-01T00:00:00.000Z" })).toEqual([]);
      // A cutoff in the future treats the lease as abandoned.
      expect(await claim({ leaseCutoff: "2099-01-01T00:00:00.000Z" })).toHaveLength(1);
    });

    it("never hands out a processed event again", async () => {
      await recordCompletions(service, TEST_SOURCE, [{ externalId: "9", name: "Finals" }], NOW);
      const [taken] = await claim();
      if (taken === undefined) throw new Error("nothing claimed");

      await markCompletionProcessed(service, taken, NOW);
      expect(await claim({ leaseCutoff: "2099-01-01T00:00:00.000Z" })).toEqual([]);
    });

    it("releases a failure for a retry, and stops retrying after the last attempt", async () => {
      await recordCompletions(service, TEST_SOURCE, [{ externalId: "9", name: "Finals" }], NOW);

      const [first] = await claim({ maxAttempts: 2 });
      if (first === undefined) throw new Error("nothing claimed");
      await markCompletionFailed(service, first, "melee responded 429");

      const [second] = await claim({ maxAttempts: 2 });
      expect(second).toMatchObject({ attempts: 2, lastError: "melee responded 429" });
      if (second === undefined) throw new Error("nothing claimed");
      await markCompletionFailed(service, second, "melee responded 429");

      expect(await claim({ maxAttempts: 2 })).toEqual([]);
    });

    async function signIn(email: string) {
      const session = createClient(url, anonKey, { auth: { persistSession: false } });
      const { error } = await session.auth.signInWithPassword({
        email,
        password: "seed-password-not-a-secret",
      });
      if (error !== null) throw new Error(`could not sign in as ${email}: ${error.message}`);
      return session;
    }

    it("lets an admin send everything round again, backfilling complete calendar events", async () => {
      await replaceEvents(
        service,
        TEST_SOURCE,
        [
          { ...event("1", "Done, never queued"), state: "complete" },
          { ...event("2", "Still to come"), state: "scheduled" },
        ],
        FETCHED_AT,
      );
      await recordCompletions(service, TEST_SOURCE, [{ externalId: "9", name: "Finals" }], NOW);
      const [taken] = await claim();
      if (taken === undefined) throw new Error("nothing claimed");
      await markCompletionProcessed(service, taken, NOW);

      const admin = await signIn("newsdesk@planarstandard.test");
      expect(await requeueAllCompletions(admin, TEST_SOURCE)).toBe(2);

      const waiting = (await listCompletions(admin, 100)).filter((c) => c.source === TEST_SOURCE);
      expect(waiting.map((c) => [c.externalId, c.processedAt, c.attempts]).sort()).toEqual([
        ["1", null, 0],
        ["9", null, 0],
      ]);
    });

    it("keeps the queue, and the re-run, from anyone but an admin", async () => {
      await recordCompletions(service, TEST_SOURCE, [{ externalId: "9", name: "Finals" }], NOW);
      const writer = await signIn("wrenfield@planarstandard.test");

      expect(await listCompletions(writer, 100)).toEqual([]);
      expect(await requeueAllCompletions(writer, TEST_SOURCE)).toBe(0);
      const [row] = await claim();
      expect(row?.attempts).toBe(1);
    });

    it("keeps the queue away from the public client", async () => {
      await recordCompletions(service, TEST_SOURCE, [{ externalId: "9", name: "Finals" }], NOW);
      const { data } = await client.from("event_completions").select("external_id");
      expect(data ?? []).toEqual([]);
    });
  });
});
