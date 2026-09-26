import type { ParsedEvent, ParsedMatch, ParsedStanding } from "@ps/contracts";

/**
 * One row per player an event names, for `tournament_entries` (E18.21).
 *
 * Placements are the source's when it reported any. Otherwise they come from a
 * clean single-elimination playoff, which is what "top 4" means: the final's
 * winner and loser, then each earlier round's losers sharing a place (3, 5, …).
 * That reads finishes off pairings, never the reverse (ADR 006). A record the
 * source did not report is tallied from the pairings.
 */
export interface EventEntry {
  readonly handle: string;
  readonly placement: number | null;
  readonly matchWins: number;
  readonly matchLosses: number;
  readonly matchDraws: number;
  readonly gameWins: number;
  readonly gameLosses: number;
  readonly dropped: boolean;
}

export function eventEntries(event: Pick<ParsedEvent, "matches" | "standings">): EventEntry[] {
  const matches = event.matches ?? [];
  const standings = new Map((event.standings ?? []).map((s) => [s.handle, s]));
  const tallies = tally(matches);
  const reported = [...standings.values()].some((s) => s.placement !== undefined);
  const bracket = reported ? new Map<string, number>() : playoffPlacements(matches);

  const handles = new Set([...tallies.keys(), ...standings.keys()]);
  return [...handles].map((handle) => {
    const standing: ParsedStanding | undefined = standings.get(handle);
    const counted = tallies.get(handle) ?? EMPTY;
    return {
      handle,
      placement: standing?.placement ?? bracket.get(handle) ?? null,
      matchWins: standing?.matchWins ?? counted.matchWins,
      matchLosses: standing?.matchLosses ?? counted.matchLosses,
      matchDraws: standing?.matchDraws ?? counted.matchDraws,
      gameWins: standing?.gameWins ?? counted.gameWins,
      gameLosses: standing?.gameLosses ?? counted.gameLosses,
      dropped: standing?.dropped ?? false,
    };
  });
}

type Record = Omit<EventEntry, "handle" | "placement" | "dropped">;

const EMPTY: Record = { matchWins: 0, matchLosses: 0, matchDraws: 0, gameWins: 0, gameLosses: 0 };

function tally(matches: readonly ParsedMatch[]): Map<string, Record> {
  const records = new Map<string, Record>();
  const add = (handle: string, change: Partial<Record>) => {
    const now = records.get(handle) ?? EMPTY;
    records.set(handle, {
      matchWins: now.matchWins + (change.matchWins ?? 0),
      matchLosses: now.matchLosses + (change.matchLosses ?? 0),
      matchDraws: now.matchDraws + (change.matchDraws ?? 0),
      gameWins: now.gameWins + (change.gameWins ?? 0),
      gameLosses: now.gameLosses + (change.gameLosses ?? 0),
    });
  };

  for (const match of matches) {
    const p1Games = match.p1Games ?? 0;
    const p2Games = match.p2Games ?? 0;
    const p1 = { gameWins: p1Games, gameLosses: p2Games };
    const p2 = { gameWins: p2Games, gameLosses: p1Games };
    const other = match.p2Handle;

    switch (match.result) {
      case "bye":
        add(match.p1Handle, { matchWins: 1 });
        break;
      case "p1_win":
        add(match.p1Handle, { ...p1, matchWins: 1 });
        if (other !== undefined) add(other, { ...p2, matchLosses: 1 });
        break;
      case "p2_win":
        add(match.p1Handle, { ...p1, matchLosses: 1 });
        if (other !== undefined) add(other, { ...p2, matchWins: 1 });
        break;
      case "draw":
        add(match.p1Handle, { ...p1, matchDraws: 1 });
        if (other !== undefined) add(other, { ...p2, matchDraws: 1 });
        break;
      case "double_loss":
        add(match.p1Handle, { ...p1, matchLosses: 1 });
        if (other !== undefined) add(other, { ...p2, matchLosses: 1 });
        break;
      case null:
        add(match.p1Handle, {});
        if (other !== undefined) add(other, {});
    }
  }
  return records;
}

/** Empty unless the playoff is a clean bracket: one final, then 2, 4, … matches a round. */
function playoffPlacements(matches: readonly ParsedMatch[]): Map<string, number> {
  const decided = matches.filter(
    (m) =>
      m.isElimination === true &&
      m.round !== undefined &&
      m.p2Handle !== undefined &&
      (m.result === "p1_win" || m.result === "p2_win"),
  );
  const rounds = [...new Set(decided.map((m) => m.round ?? 0))].sort((a, b) => b - a);
  const placements = new Map<string, number>();

  for (const [depth, round] of rounds.entries()) {
    const inRound = decided.filter((m) => m.round === round);
    if (inRound.length !== 2 ** depth) break;
    for (const match of inRound) {
      const [winner, loser] =
        match.result === "p1_win"
          ? [match.p1Handle, match.p2Handle ?? ""]
          : [match.p2Handle ?? "", match.p1Handle];
      if (depth === 0) placements.set(winner, 1);
      placements.set(loser, 2 ** depth + 1);
    }
  }
  return placements;
}
