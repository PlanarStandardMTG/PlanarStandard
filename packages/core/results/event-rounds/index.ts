/** What a match needs for its event to be laid out round by round. */
export interface RoundMatch {
  readonly round: number;
  readonly isElimination: boolean;
}

export interface EventRound<M extends RoundMatch> {
  readonly round: number;
  /** "Round 3" in the Swiss; "Quarterfinals", "Semifinals", "Final" or "Top 16" in a cut. */
  readonly label: string;
  readonly isElimination: boolean;
  readonly matches: readonly M[];
}

/**
 * An event's matches as its rounds, in playing order. The Swiss is numbered
 * from 1 whatever the ledger numbered it; a cut round is named for how many
 * players are left in it, which is what its matches count.
 */
export function eventRounds<M extends RoundMatch>(matches: readonly M[]): EventRound<M>[] {
  const byRound = new Map<number, M[]>();
  for (const match of matches)
    byRound.set(match.round, [...(byRound.get(match.round) ?? []), match]);

  let swiss = 0;
  return [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, inRound]) => {
      const isElimination = inRound.some((match) => match.isElimination);
      return {
        round,
        label: isElimination ? cutLabel(inRound.length) : `Round ${++swiss}`,
        isElimination,
        matches: inRound,
      };
    });
}

function cutLabel(matches: number): string {
  if (matches === 1) return "Final";
  if (matches === 2) return "Semifinals";
  if (matches === 4) return "Quarterfinals";
  return `Top ${matches * 2}`;
}
