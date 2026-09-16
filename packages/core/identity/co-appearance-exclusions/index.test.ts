import type { IdentityId, TournamentId } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { coAppearanceExclusions, exclusionIndex, exclusionKey } from "./index";

const id = (s: string): IdentityId => s as IdentityId;
const event = (s: string): TournamentId => s as TournamentId;

describe("core/identity/co-appearance-exclusions", () => {
  it("excludes every pair that shared an event", () => {
    const exclusions = coAppearanceExclusions([
      { tournamentId: event("nov-02"), identityIds: [id("a"), id("b"), id("c")] },
    ]);
    expect(exclusions).toHaveLength(3);
    expect(exclusions.every((e) => e.reason === "co_appearance")).toBe(true);
    expect(exclusions.every((e) => e.tournamentId === "nov-02")).toBe(true);
  });

  it("emits ordered pairs, satisfying the identity_a < identity_b check", () => {
    const exclusions = coAppearanceExclusions([
      { tournamentId: event("nov-02"), identityIds: [id("zeta"), id("alpha")] },
    ]);
    expect(exclusions[0]).toMatchObject({ identityA: "alpha", identityB: "zeta" });
    for (const e of exclusions) expect(e.identityA < e.identityB).toBe(true);
  });

  it("records a pair once even when they met repeatedly", () => {
    const exclusions = coAppearanceExclusions([
      { tournamentId: event("nov-02"), identityIds: [id("a"), id("b")] },
      { tournamentId: event("nov-08"), identityIds: [id("a"), id("b")] },
    ]);
    expect(exclusions).toHaveLength(1);
    expect(exclusions[0]?.tournamentId).toBe("nov-02");
  });

  it("tolerates a roster that lists someone twice", () => {
    const exclusions = coAppearanceExclusions([
      { tournamentId: event("nov-02"), identityIds: [id("a"), id("a"), id("b")] },
    ]);
    expect(exclusions).toHaveLength(1);
  });

  it("produces nothing for an event with one player, or none", () => {
    expect(coAppearanceExclusions([{ tournamentId: event("x"), identityIds: [id("a")] }])).toEqual(
      [],
    );
    expect(coAppearanceExclusions([])).toEqual([]);
  });

  it("keys a pair the same way whichever order it is asked about", () => {
    expect(exclusionKey(id("b"), id("a"))).toBe(exclusionKey(id("a"), id("b")));
  });

  it("indexes exclusions for lookup", () => {
    const index = exclusionIndex(
      coAppearanceExclusions([{ tournamentId: event("nov-02"), identityIds: [id("a"), id("b")] }]),
    );
    expect(index.has(exclusionKey(id("b"), id("a")))).toBe(true);
  });
});
