import type { RunGames } from "@ps/contracts";

/**
 * A result as a player or organizer picks it from a list, from one side's point of view:
 * `2-1-0` is two games won, one lost, none drawn.
 */
export interface ResultChoice {
  readonly code: string;
  readonly won: number;
  readonly lost: number;
  readonly drawn: number;
}

const choice = (won: number, lost: number, drawn: number): ResultChoice => ({
  code: `${won}-${lost}-${drawn}`,
  won,
  lost,
  drawn,
});

/** Best-of-three outcomes. An intentional draw with no games played is 0–0–3 (MTR §2.5). */
const SWISS: readonly ResultChoice[] = [
  choice(2, 0, 0),
  choice(2, 1, 0),
  choice(1, 2, 0),
  choice(0, 2, 0),
  choice(1, 1, 1),
  choice(1, 1, 0),
  choice(1, 0, 1),
  choice(0, 1, 1),
  choice(0, 0, 3),
];

/** The choices a round offers: no draws in the top cut (MTR §2.4). */
export function resultChoices(elimination: boolean): readonly ResultChoice[] {
  return elimination ? SWISS.filter((c) => c.won !== c.lost) : SWISS;
}

/**
 * A chosen result as the pairing stores it, from player 1's side. Null when the code is
 * not one the round offers — a draw in the cut, or anything made up.
 */
export function gamesFromChoice(
  code: string,
  side: "p1" | "p2",
  elimination: boolean,
): RunGames | null {
  const picked = resultChoices(elimination).find((c) => c.code === code);
  if (picked === undefined) return null;
  return side === "p1"
    ? { p1Wins: picked.won, p2Wins: picked.lost, draws: picked.drawn }
    : { p1Wins: picked.lost, p2Wins: picked.won, draws: picked.drawn };
}
