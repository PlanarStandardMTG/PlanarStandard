import type { ArchetypeId } from "@ps/contracts";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { findArchetypeByAlias, getArchetype, listArchetypes } from "./index";
import { normalizeAlias } from "./rows";

/**
 * Runs against a local Supabase with the seed loaded (`pnpm db:reset`).
 *
 * Read-only, and asserted against the five seeded archetypes rather than against
 * rows of its own: `seed/0005_archetypes.sql` is the vocabulary the rest of the
 * repository already names, so a test that invented its own would be proving the
 * queries work on data nothing else has.
 *
 * Skipped rather than failed when nothing is listening, as with every suite here.
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

const client = createClient(url, anonKey);

const ABZAN = "33333333-3333-4333-8333-000000000003" as ArchetypeId;

describe.skipIf(!reachable)("repos/archetypes", () => {
  it("reads the vocabulary with its aliases, mapped to the contract", async () => {
    const all = await listArchetypes(client);

    expect(all.map((a) => a.name)).toEqual([
      "4c Dragons",
      "Abzan Midrange",
      "Azorius Control",
      "Dimir Faeries",
      "Golgari Midrange",
    ]);

    const dragons = all.find((a) => a.name === "4c Dragons");
    expect(dragons).toMatchObject({ supertype: "midrange", colorIdentity: ["W", "U", "B", "G"] });
    expect(dragons?.aliases).toEqual(["4c Dragons (Midrange)", "Four-Colour Dragons"]);
  });

  it("files tempo under `other` rather than the supertype it is least unlike", async () => {
    // Tempo is not one of the five, and the seed says so deliberately. If this
    // ever reads "midrange", somebody has quietly widened the vocabulary.
    const all = await listArchetypes(client);
    expect(all.find((a) => a.name === "Dimir Faeries")?.supertype).toBe("other");
  });

  it("resolves the label form a source actually prints", async () => {
    // What `archetype-map-html` reports as `archetypeRaw` (E12.7).
    const resolved = await findArchetypeByAlias(client, "4c Dragons (Midrange)");
    expect(resolved?.name).toBe("4c Dragons");
  });

  it("ignores punctuation, spacing and case in an alias", async () => {
    for (const spelling of [
      "4C-DRAGONS (midrange)",
      "4cdragonsmidrange",
      "4c  Dragons(Midrange)",
    ]) {
      const resolved = await findArchetypeByAlias(client, spelling);
      expect(resolved?.name, spelling).toBe("4c Dragons");
    }
  });

  it("resolves an archetype's own name, which the vocabulary does not list as an alias", async () => {
    const exact = await findArchetypeByAlias(client, "Abzan Midrange");
    const cased = await findArchetypeByAlias(client, "abzan midrange");

    expect(exact?.id).toBe(ABZAN);
    expect(cased?.id).toBe(ABZAN);
  });

  it("returns null for a label nobody has taught it", async () => {
    // Not a throw: an unrecognised label leaves the deck with its raw string and
    // no archetype until somebody adds the alias (E12.7, E18.10).
    expect(await findArchetypeByAlias(client, "Jeskai Ascendancy Combo")).toBeNull();
    expect(await findArchetypeByAlias(client, "   ")).toBeNull();
  });

  it("does not let a wildcard in the label match more than itself", async () => {
    // `%` and `_` are `ilike` pattern syntax, so an unescaped label would match
    // every archetype at once and `maybeSingle` would error rather than miss.
    expect(await findArchetypeByAlias(client, "%")).toBeNull();
    expect(await findArchetypeByAlias(client, "Abzan_Midrange")).toBeNull();
  });

  it("reads one archetype by id, and null for an unknown one", async () => {
    expect((await getArchetype(client, ABZAN))?.name).toBe("Abzan Midrange");
    expect(
      await getArchetype(client, "00000000-0000-4000-8000-000000000000" as ArchetypeId),
    ).toBeNull();
  });

  it("normalizes the way the generated column does", async () => {
    // The parity that `findArchetypeByAlias` depends on. `archetype_aliases.normalized`
    // is computed by Postgres; drift here would not fail, it would silently stop
    // matching — which is how a season's decks end up unlabelled.
    const { data } = await client.from("archetype_aliases").select("alias, normalized");
    const rows = (data ?? []) as { alias: string; normalized: string }[];

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((r) => normalizeAlias(r.alias))).toEqual(rows.map((r) => r.normalized));
  });
});
