import type { RunEntrantId, RunStanding } from "@ps/contracts";

/**
 * Who should get the bye, in the order to try them: lowest-ranked first among those
 * who have not had one, then — only if everyone has — lowest-ranked first among the
 * rest. `pair-swiss` walks this list when the first choice leaves no legal pairing.
 */
export function byeCandidates(
  standings: readonly RunStanding[],
  eligible: ReadonlySet<RunEntrantId>,
): RunEntrantId[] {
  const lowestFirst = standings.filter((s) => eligible.has(s.entrantId)).reverse();
  return [...lowestFirst.filter((s) => s.byes === 0), ...lowestFirst.filter((s) => s.byes > 0)].map(
    (s) => s.entrantId,
  );
}

/** The lowest-ranked eligible entrant without a bye; null when nobody is eligible. */
export function assignBye(
  standings: readonly RunStanding[],
  eligible: ReadonlySet<RunEntrantId>,
): RunEntrantId | null {
  return byeCandidates(standings, eligible)[0] ?? null;
}
