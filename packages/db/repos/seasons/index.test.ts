import type { IsoDate, SeasonId } from "@ps/contracts";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

import { findSeasonForDate, getCurrentSeason, getSeason, listSeasons, saveSeason } from "./index";

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

/** Its own variable, never the production service-role name — see `repos/events`. */
const serviceKey =
  process.env["SUPABASE_LOCAL_SERVICE_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const client = createClient(url, anonKey);
const service = createClient(url, serviceKey);
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

/**
 * Writes, dated 2018–2019: before every seeded season and every other suite's
 * rows, so re-filing tournaments here never moves one somebody else is reading.
 * Marking a season current is undone within the same test — this suite is the
 * only one that reads the current season from the database.
 */
describe.skipIf(!reachable)("repos/seasons — saveSeason", () => {
  const run = Date.now();
  const seasons: SeasonId[] = [];
  const tournaments: string[] = [];
  afterAll(async () => {
    await service.from("tournaments").delete().in("id", tournaments);
    await service.from("seasons").delete().in("id", seasons);
  });

  it("numbers a new season after the seeded ones and lists newest first", async () => {
    const id = await saveSeason(service, null, {
      name: `vitest ${run}`,
      startsOn: "2019-01-01" as IsoDate,
      endsOn: "2019-03-31" as IsoDate,
      isCurrent: false,
    });
    seasons.push(id);

    const created = await getSeason(client, id);
    const all = await listSeasons(client);
    const ordinals = all.map((season) => season.ordinal);

    expect(created?.ordinal).toBeGreaterThan(3);
    expect(ordinals).toContain(created?.ordinal);
    expect(ordinals).toEqual([...ordinals].sort((a, b) => b - a));
  });

  it("re-files tournaments to follow the season's dates", async () => {
    const { data } = await service
      .from("tournaments")
      .insert({
        name: "vitest season event",
        slug: `vitest-season-${run}`,
        event_date: "2019-02-01",
      })
      .select("id")
      .single();
    const event = (data as { id: string }).id;
    tournaments.push(event);
    const seasonOf = async () =>
      (
        (await service.from("tournaments").select("season_id").eq("id", event).single()).data as {
          season_id: string | null;
        }
      ).season_id;

    const id = await saveSeason(service, null, {
      name: `vitest refile ${run}`,
      startsOn: "2018-01-01" as IsoDate,
      endsOn: "2018-12-31" as IsoDate,
      isCurrent: false,
    });
    seasons.push(id);
    expect(await seasonOf()).not.toBe(id);

    await saveSeason(service, id, {
      name: `vitest refile ${run}`,
      startsOn: "2018-01-01" as IsoDate,
      endsOn: "2019-06-30" as IsoDate,
      isCurrent: false,
    });
    // The 2019-01-01 season above also spans it; the last save wins, which is
    // why the admin form refuses overlapping seasons.
    expect(await seasonOf()).toBe(id);

    await saveSeason(service, id, {
      name: `vitest refile ${run}`,
      startsOn: "2018-01-01" as IsoDate,
      endsOn: "2018-12-31" as IsoDate,
      isCurrent: false,
    });
    expect(await seasonOf()).toBeNull();
  });

  it("marks one season current and un-marks the old one", async () => {
    const before = await getCurrentSeason(client);
    const id = await saveSeason(service, null, {
      name: `vitest current ${run}`,
      startsOn: "2017-01-01" as IsoDate,
      endsOn: "2017-12-31" as IsoDate,
      isCurrent: true,
    });
    seasons.push(id);

    try {
      expect((await getCurrentSeason(client))?.id).toBe(id);
      expect((await getSeason(client, before?.id ?? ("" as SeasonId)))?.isCurrent).toBe(false);
    } finally {
      await service.from("seasons").update({ is_current: false }).eq("id", id);
      if (before !== null)
        await service.from("seasons").update({ is_current: true }).eq("id", before.id);
    }
  });
});
