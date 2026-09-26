import type { IdentityId, TournamentId } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { mergeBlockers } from "./index";

const id = (s: string) => s as IdentityId;
const event = (tournamentId: string, ...identities: string[]) => ({
  tournamentId: tournamentId as TournamentId,
  identityIds: identities.map(id),
});

describe("core/identity/merge-blockers", () => {
  it("names the event where a handle of each played", () => {
    expect(
      mergeBlockers(
        [id("a1"), id("a2")],
        [id("b1")],
        [event("t1", "a2", "b1", "c1"), event("t2", "a1")],
      ),
    ).toEqual(["t1"]);
  });

  it("is empty for two players who never shared an event", () => {
    expect(
      mergeBlockers([id("a1")], [id("b1")], [event("t1", "a1", "c1"), event("t2", "b1", "c1")]),
    ).toEqual([]);
  });

  it("does not count one player's own handles meeting each other", () => {
    expect(mergeBlockers([id("a1"), id("a2")], [id("b1")], [event("t1", "a1", "a2")])).toEqual([]);
  });

  it("names each blocking event once", () => {
    expect(
      mergeBlockers(
        [id("a1"), id("a2")],
        [id("b1")],
        [event("t1", "a1", "a2", "b1"), event("t2", "b1", "a1")],
      ),
    ).toEqual(["t1", "t2"]);
  });
});
