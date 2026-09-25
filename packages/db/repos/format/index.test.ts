import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { FormatVersionDraft, FormatVersionId, OracleId, SetCode } from "@ps/contracts";

import {
  deleteFormatVersion,
  getCurrentFormatDetail,
  getCurrentFormatVersion,
  getFormatDetail,
  listFormatVersions,
  saveFormatVersion,
} from "./index";

/**
 * Runs against a local Supabase with the seed loaded (`pnpm db:reset`).
 *
 * Skipped rather than failed when nothing is listening: `db` is the one package
 * allowed to need infrastructure, and the zero-credential promise for everyone
 * else only holds if a missing instance is a skip and not a red suite.
 *
 * The reads leave the seed alone — the seeded pool is what `/rules` renders
 * locally and `pnpm test` must not disturb it. The admin writes below make
 * their own versions, delete them, and put back the current one if they move it.
 */
const url = process.env["SUPABASE_URL"] ?? "http://127.0.0.1:54321";
const anonKey =
  process.env["SUPABASE_ANON_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const reachable = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: anonKey },
  signal: AbortSignal.timeout(1500),
})
  .then((r) => r.ok)
  .catch(() => false);

const client = createClient(url, anonKey, { auth: { persistSession: false } });
const serviceKey =
  process.env["SUPABASE_LOCAL_SERVICE_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const service = createClient(url, serviceKey, { auth: { persistSession: false } });

/** The special-event pool from the seed: Foundations only, singleton, 100 cards. */
const GAUNTLET = "22222222-2222-4222-8222-000000000002";

describe.skipIf(!reachable)("db/repos/format", () => {
  it("finds the one current version", async () => {
    const version = await getCurrentFormatVersion(client);

    expect(version?.name).toBe("Planar Standard");
    expect(version?.isCurrent).toBe(true);
    expect(version?.effectiveTo).toBeNull();
  });

  it("returns the pool the rules page publishes", async () => {
    const detail = await getCurrentFormatDetail(client);

    // Six sets, sorted, exactly as `content/pages/rules.mdx` lists them.
    expect(detail?.legalSets).toEqual(["DFT", "ECL", "EOE", "FDN", "SOS", "TDM"]);
  });

  it("returns the constraints rather than assuming the defaults", async () => {
    const detail = await getCurrentFormatDetail(client);

    expect(detail?.constraints).toEqual({
      minMaindeck: 60,
      maxMaindeck: null,
      maxSideboard: 15,
      maxCopies: 4,
      singleton: false,
      extraRules: {},
    });
  });

  it("reports an empty banlist as empty, not as missing", async () => {
    const detail = await getCurrentFormatDetail(client);

    // Nothing is banned in the seed, and `<Banlist />` has to render that state.
    expect(detail?.cardRules).toEqual([]);
  });

  it("reads a special event's own pool by id, not whatever is current", async () => {
    const detail = await getFormatDetail(client, GAUNTLET);

    expect(detail?.version.name).toBe("Foundations Gauntlet");
    expect(detail?.version.isCurrent).toBe(false);
    expect(detail?.legalSets).toEqual(["FDN"]);
    expect(detail?.constraints).toMatchObject({ singleton: true, maxCopies: 1, minMaindeck: 100 });
  });

  it("is null for a version that does not exist", async () => {
    expect(await getFormatDetail(client, "22222222-2222-4222-8222-999999999999")).toBeNull();
  });
});

describe.skipIf(!reachable)("db/repos/format — admin edits", () => {
  const SEEDED_CURRENT = "22222222-2222-4222-8222-000000000001" as FormatVersionId;
  const SOME_CARD = "00000000-0000-4000-8000-00000000c0de" as OracleId;

  async function signIn(email: string) {
    const session = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error } = await session.auth.signInWithPassword({
      email,
      password: "seed-password-not-a-secret",
    });
    if (error !== null) throw new Error(`could not sign in as ${email}: ${error.message}`);
    return session;
  }

  const draft = (over: Partial<FormatVersionDraft> = {}): FormatVersionDraft => ({
    name: "Test pool",
    effectiveFrom: "2026-10-01",
    effectiveTo: null,
    notesMarkdown: null,
    isCurrent: false,
    legalSets: ["FDN" as SetCode],
    constraints: {
      minMaindeck: 40,
      maxMaindeck: null,
      maxSideboard: 0,
      maxCopies: 4,
      singleton: false,
    },
    cardRules: [],
    ...over,
  });

  it("creates, replaces and deletes a version with its sets, constraints and rules", async () => {
    const admin = await signIn("newsdesk@planarstandard.test");
    const id = await saveFormatVersion(
      admin,
      null,
      draft({
        cardRules: [
          { oracleId: SOME_CARD, ruling: "banned", reason: "Too strong", effectiveFrom: null },
        ],
      }),
    );

    try {
      expect(await getFormatDetail(client, id)).toMatchObject({
        version: { name: "Test pool", isCurrent: false },
        legalSets: ["FDN"],
        constraints: { minMaindeck: 40, maxSideboard: 0 },
        cardRules: [{ oracleId: SOME_CARD, ruling: "banned", reason: "Too strong" }],
      });

      await saveFormatVersion(
        admin,
        id,
        draft({ name: "Renamed", legalSets: ["DFT", "TDM"] as SetCode[] }),
      );
      const replaced = await getFormatDetail(client, id);
      expect(replaced?.version.name).toBe("Renamed");
      expect(replaced?.legalSets).toEqual(["DFT", "TDM"]);
      expect(replaced?.cardRules).toEqual([]);
      expect((await listFormatVersions(client)).map((v) => v.id)).toContain(id);
    } finally {
      expect(await deleteFormatVersion(admin, id)).toEqual({ ok: true });
    }
    expect(await getFormatDetail(client, id)).toBeNull();
  });

  it("moves 'current' to a new version and back, keeping exactly one", async () => {
    const admin = await signIn("newsdesk@planarstandard.test");
    const id = await saveFormatVersion(admin, null, draft({ isCurrent: true }));

    try {
      expect((await getCurrentFormatVersion(client))?.id).toBe(id);
      expect(await deleteFormatVersion(admin, id)).toEqual({ ok: false, reason: "current" });
    } finally {
      const seeded = await getFormatDetail(client, SEEDED_CURRENT);
      if (seeded === null) throw new Error("the seeded version is gone");
      await service.from("format_versions").update({ is_current: false }).eq("id", id);
      await service.from("format_versions").update({ is_current: true }).eq("id", SEEDED_CURRENT);
      await deleteFormatVersion(admin, id);
    }
    expect((await getCurrentFormatVersion(client))?.id).toBe(SEEDED_CURRENT);
  });

  it("refuses to delete a version a deck names, and lets nobody but an admin write", async () => {
    const admin = await signIn("newsdesk@planarstandard.test");
    const id = await saveFormatVersion(admin, null, draft());
    const { data: deck } = await service
      .from("decks")
      .insert({
        name: "Pinned",
        format_version_id: id,
        submitted_via: "import",
        visibility: "private",
      })
      .select("id")
      .single();

    try {
      expect(await deleteFormatVersion(admin, id)).toEqual({ ok: false, reason: "in-use" });
      const writer = await signIn("wrenfield@planarstandard.test");
      await expect(saveFormatVersion(writer, null, draft())).rejects.toThrow(
        /saveFormatVersion failed/,
      );
    } finally {
      await service.from("decks").delete().eq("id", deck?.id);
      await deleteFormatVersion(admin, id);
    }
  });
});
