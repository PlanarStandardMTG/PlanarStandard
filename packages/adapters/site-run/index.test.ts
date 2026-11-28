import type { RunEntrant, RunPairing, RunRound } from "@ps/contracts";
import { toParsedEvent, type FinishedRun } from "@ps/core";
import { describe, expect, it } from "vitest";

import { siteRun, siteRunInput } from "./index";

const entrant = (id: string, handle: string | null): RunEntrant => ({
  id,
  runId: "run",
  profileId: handle === null ? null : `profile-${id}`,
  displayName: id,
  handle,
  checkedIn: true,
  droppedAfterRound: null,
});

const finished: FinishedRun = {
  name: "Planar Standard Weekly #42",
  date: "2026-10-17",
  run: { seed: "seed", topCut: 0 },
  entrants: [entrant("e1", "brayzon"), entrant("e2", null)],
  rounds: [
    { id: "r1", runId: "run", number: 1, kind: "swiss", pairedAt: "2026-10-17T19:00:00Z" },
  ] satisfies RunRound[],
  pairings: [
    {
      id: "p1",
      roundId: "r1",
      round: 1,
      table: 1,
      p1EntrantId: "e1",
      p2EntrantId: "e2",
      games: { p1Wins: 2, p2Wins: 1, draws: 0 },
      status: "confirmed",
    },
  ] satisfies RunPairing[],
  decklists: new Map([["e1", "4 Llanowar Elves\n36 Forest"]]),
};

describe("adapters/site-run", () => {
  it("reads back exactly what core/runs/to-parsed-event makes of the run", () => {
    const input = siteRunInput(finished, "run-run.json");

    expect(siteRun.detect(input)).toBe(true);
    expect(siteRun.parse(input)).toEqual(toParsedEvent(finished));
  });

  it("enters a guest by entrant id, never by the name they were typed in as", () => {
    const parsed = siteRun.parse(siteRunInput(finished, "run.json"));
    expect(parsed.matches?.[0]).toMatchObject({
      p1Handle: "brayzon",
      p2Handle: "run-guest-e2",
      result: "p1_win",
    });
  });

  it("encodes the same run to the same bytes, so finishing twice writes nothing new", () => {
    const a = siteRunInput(finished, "a.json").bytes;
    const b = siteRunInput(finished, "b.json").bytes;
    expect(a).toEqual(b);
  });

  it("claims only its own documents", () => {
    const other = {
      fileName: "x.json",
      bytes: new TextEncoder().encode('{"adapter":"manual-entry"}'),
    };
    expect(siteRun.detect(other)).toBe(false);
    expect(siteRun.parse(other)).toMatchObject({ capabilities: [] });
    expect("matches" in siteRun.parse(other)).toBe(false);
  });
});
