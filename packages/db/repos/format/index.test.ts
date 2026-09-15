import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { getCurrentFormatDetail, getCurrentFormatVersion, getFormatDetail } from "./index";

/**
 * Runs against a local Supabase with the seed loaded (`pnpm db:reset`).
 *
 * Skipped rather than failed when nothing is listening: `db` is the one package
 * allowed to need infrastructure, and the zero-credential promise for everyone
 * else only holds if a missing instance is a skip and not a red suite.
 *
 * Read-only throughout — the seeded pool is what `/rules` renders locally and
 * `pnpm test` must not disturb it.
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
