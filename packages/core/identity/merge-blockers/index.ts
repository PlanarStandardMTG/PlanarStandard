import type { IdentityId, TournamentId } from "@ps/contracts";

import type { EventRoster } from "../co-appearance-exclusions/index";

/**
 * The events that make two players two people: any tournament where a handle of
 * one and a handle of the other both played (E18.16) — the co-appearance rule
 * (E9.7), asked about every event rather than once per pair of handles.
 * Non-empty refuses the merge, whatever an admin believes: nobody plays
 * themselves.
 */
export function mergeBlockers(
  identitiesA: readonly IdentityId[],
  identitiesB: readonly IdentityId[],
  rosters: readonly EventRoster[],
): readonly TournamentId[] {
  const a = new Set<string>(identitiesA);
  const b = new Set<string>(identitiesB);

  const blocking = rosters
    .filter(
      (roster) =>
        roster.identityIds.some((id) => a.has(id)) && roster.identityIds.some((id) => b.has(id)),
    )
    .map((roster) => roster.tournamentId);
  return [...new Set(blocking)];
}
