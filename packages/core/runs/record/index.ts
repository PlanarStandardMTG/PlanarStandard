import type { RunEntrantId, RunGames, RunPairing, RunRecord } from "@ps/contracts";

/** MTR Appendix C: a bye is a 2–0 win. */
const BYE_GAMES: RunGames = { p1Wins: 2, p2Wins: 0, draws: 0 };

/** A pairing that counts: a bye, or a played pairing whose result is confirmed (E26.20). */
export function isCounted(pairing: RunPairing): boolean {
  if (pairing.p2EntrantId === null) return true;
  return pairing.status === "confirmed" && pairing.games !== null;
}

/** The games a counted pairing scores, a bye's included. */
export function countedGames(pairing: RunPairing): RunGames | null {
  if (pairing.p2EntrantId === null) return BYE_GAMES;
  return isCounted(pairing) ? pairing.games : null;
}

type Tally = { -readonly [K in keyof RunRecord]: RunRecord[K] };

function empty(entrantId: RunEntrantId): Tally {
  return {
    entrantId,
    matchPoints: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    byes: 0,
    roundsPlayed: 0,
    gamePoints: 0,
    gamesPlayed: 0,
  };
}

/** Adds one side of a match: `won` and `lost` are that side's game wins and losses. */
function add(tally: Tally, won: number, lost: number, drawn: number): void {
  tally.roundsPlayed += 1;
  tally.gamesPlayed += won + lost + drawn;
  // MTR Appendix C: 3 game points a game won, 1 a game drawn.
  tally.gamePoints += 3 * won + drawn;
  if (won > lost) {
    tally.wins += 1;
    tally.matchPoints += 3;
  } else if (won < lost) {
    tally.losses += 1;
  } else {
    tally.draws += 1;
    tally.matchPoints += 1;
  }
}

/**
 * Every entrant's record from the pairings that count. An entrant with none still gets a
 * zero record, so a caller never has to ask whether one exists.
 */
export function runRecords(
  entrantIds: readonly RunEntrantId[],
  pairings: readonly RunPairing[],
): ReadonlyMap<RunEntrantId, RunRecord> {
  const tallies = new Map(entrantIds.map((id) => [id, empty(id)]));
  const tallyFor = (id: RunEntrantId): Tally => {
    const existing = tallies.get(id);
    if (existing !== undefined) return existing;
    const created = empty(id);
    tallies.set(id, created);
    return created;
  };

  for (const pairing of pairings) {
    const games = countedGames(pairing);
    if (games === null) continue;
    const p1 = tallyFor(pairing.p1EntrantId);
    add(p1, games.p1Wins, games.p2Wins, games.draws);
    if (pairing.p2EntrantId === null) {
      p1.byes += 1;
    } else {
      add(tallyFor(pairing.p2EntrantId), games.p2Wins, games.p1Wins, games.draws);
    }
  }
  return tallies;
}
