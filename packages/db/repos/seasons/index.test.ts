import type { IsoDate } from "@ps/contracts";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { findSeasonForDate, getCurrentSeason } from "./index";

/** Runs against a local Supabase with the seed loaded (`pnpm db:reset`): Seasons I–III, III current. */
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
const on = (date: string) => findSeasonForDate(client, date as IsoDate);

describe.skipIf(!reachable)("repos/seasons", () => {
  it("reads the current season to the public client", async () => {
    const season = await getCurrentSeason(client);

    expect(season).toMatchObject({ name: "Season III", ordinal: 3, isCurrent: true, endsOn: null });
  });

  it("places a date inside the season that spans it, ends inclusive", async () => {
    expect((await on("2026-06-01"))?.ordinal).toBe(2);
    expect((await on("2026-08-29"))?.ordinal).toBe(2);
    expect((await on("2026-01-21"))?.ordinal).toBe(1);
  });

  it("places a date after an open-ended season's start in that season", async () => {
    expect((await on("2027-01-01"))?.ordinal).toBe(3);
  });

  it("places nothing between seasons or before the first", async () => {
    expect(await on("2026-09-01")).toBeNull();
    expect(await on("2025-12-31")).toBeNull();
  });
});
