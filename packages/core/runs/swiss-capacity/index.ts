/**
 * The most Swiss rounds `players` can play with nobody meeting the same opponent twice:
 * everyone else once, plus one bye each when the count is odd. A start above this is
 * refused (§28). It is a ceiling, not a promise: pairing by points can still run out of
 * opponents a round or two sooner, which the organizer meets by ending the Swiss early.
 */
export function maxSwissRounds(players: number): number {
  if (players < 2) return 0;
  return players % 2 === 0 ? players - 1 : players;
}
