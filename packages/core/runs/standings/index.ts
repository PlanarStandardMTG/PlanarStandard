import type { RunEntrant, RunPairing, RunStanding } from "@ps/contracts";

import { runRecords } from "../record/index";
import { seededRandom } from "../seeded-random/index";
import { tiebreakers } from "../tiebreakers/index";

export interface StandingsInput {
  readonly entrants: readonly RunEntrant[];
  /** The Swiss pairings only: the top cut is ranked by how far a player got, not by this. */
  readonly pairings: readonly RunPairing[];
  readonly seed: string;
  /**
   * The standings as they stood after this round: later rounds are left out, and a
   * player who dropped later is not shown as dropped yet. Omitted, they are current.
   */
  readonly throughRound?: number;
}

/**
 * Who is listed: anyone who has a pairing, and before round 1 anyone checked in. A
 * player who dropped before round 1 did not participate (MTR §2.10).
 */
function isListed(entrant: RunEntrant, paired: ReadonlySet<string>): boolean {
  if (paired.has(entrant.id)) return true;
  return entrant.checkedIn && entrant.droppedAfterRound !== 0;
}

/**
 * Ordered by match points, then opponents' match-win %, game-win % and opponents'
 * game-win % (MTR §3.1), compared at full precision. An exact tie falls to a draw from
 * the run's seed, so the order is the same on every read (ADR 004).
 */
export function runStandings({
  entrants: allEntrants,
  pairings: allPairings,
  seed,
  throughRound,
}: StandingsInput): RunStanding[] {
  const pairings =
    throughRound === undefined ? allPairings : allPairings.filter((p) => p.round <= throughRound);
  const entrants =
    throughRound === undefined
      ? allEntrants
      : allEntrants.map((e) =>
          e.droppedAfterRound !== null && e.droppedAfterRound >= throughRound
            ? { ...e, droppedAfterRound: null }
            : e,
        );
  const paired = new Set(
    pairings.flatMap((p) =>
      p.p2EntrantId === null ? [p.p1EntrantId] : [p.p1EntrantId, p.p2EntrantId],
    ),
  );
  const listed = entrants.filter((entrant) => isListed(entrant, paired));
  const records = runRecords(
    listed.map((entrant) => entrant.id),
    pairings,
  );
  const breakers = tiebreakers(records, pairings);

  const lines = listed.map((entrant) => {
    const record = records.get(entrant.id);
    const breaker = breakers.get(entrant.id);
    if (record === undefined || breaker === undefined)
      throw new Error(`no record for ${entrant.id}`);
    return {
      line: { ...record, ...breaker, rank: 0, dropped: entrant.droppedAfterRound !== null },
      tie: seededRandom(`${seed}:tie:${entrant.id}`)(),
    };
  });

  lines.sort(
    (a, b) =>
      b.line.matchPoints - a.line.matchPoints ||
      b.line.opponentMatchWinPct - a.line.opponentMatchWinPct ||
      b.line.gameWinPct - a.line.gameWinPct ||
      b.line.opponentGameWinPct - a.line.opponentGameWinPct ||
      a.tie - b.tie ||
      a.line.entrantId.localeCompare(b.line.entrantId),
  );
  return lines.map(({ line }, i) => ({ ...line, rank: i + 1 }));
}
