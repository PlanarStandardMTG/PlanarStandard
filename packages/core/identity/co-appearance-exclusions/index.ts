import type { Exclusion, IdentityId, TournamentId } from "@ps/contracts";

/** Which identities played in one event. */
export interface EventRoster {
  readonly tournamentId: TournamentId;
  readonly identityIds: readonly IdentityId[];
}

/**
 * Two handles in the same event are **never** the same person.
 *
 * The hardest fact in the identity system, and the one that makes automatic
 * merging safe to attempt at all: whatever the signals say, a player cannot have
 * played themselves. `score-candidates` zeroes any candidate covered by one of
 * these, and `merge-players` refuses the merge outright.
 *
 * Pairs come back ordered — `identityA < identityB` — because
 * `identity_exclusions` carries `check (identity_a < identity_b)` (E9.7).
 */
export function coAppearanceExclusions(rosters: readonly EventRoster[]): readonly Exclusion[] {
  // Keyed by pair, so an exclusion from several events is recorded once.
  const found = new Map<string, Exclusion>();

  for (const roster of rosters) {
    const identities = [...new Set(roster.identityIds)].sort();
    for (let i = 0; i < identities.length; i += 1) {
      for (let j = i + 1; j < identities.length; j += 1) {
        const identityA = identities[i] as IdentityId;
        const identityB = identities[j] as IdentityId;
        const key = `${identityA}|${identityB}`;
        if (found.has(key)) continue;
        found.set(key, {
          identityA,
          identityB,
          reason: "co_appearance",
          tournamentId: roster.tournamentId,
        });
      }
    }
  }

  return [...found.values()];
}

/** The pair key both this module and `score-candidates` use. Ordered, always. */
export function exclusionKey(a: IdentityId, b: IdentityId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Lookup set built once per scoring run rather than scanned per candidate. */
export function exclusionIndex(exclusions: readonly Exclusion[]): ReadonlyMap<string, Exclusion> {
  return new Map(exclusions.map((e) => [exclusionKey(e.identityA, e.identityB), e]));
}
