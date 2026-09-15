/**
 * The logistic expectation at the heart of Elo: the share of a match a player
 * rated `rating` is expected to take against one rated `opponentRating`.
 *
 * `1 / (1 + 10^((Rb - Ra) / 400))`. The 400 is the scale constant — a 400-point
 * lead is a 10:1 expectation — and is part of the Elo definition rather than a
 * tunable, so it is not in `RatingConfig`.
 */
export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}
