# tiebreakers

**Purpose.** Opponents' match-win %, game-win % and opponents' game-win % (MTR §3.1, Appendix C; E26.3).

**Inputs.** Every entrant's `RunRecord` (from `record`) and the pairings they came from.

**Outputs.** The three percentages per entrant, as fractions at full precision.

**Gotchas.** Each percentage is floored at 0.33, a player's own game-win % included. Byes are
skipped in the opponents' averages but count in the player's own match-win %. Never round
before comparing: display rounds to two decimals, standings compare the full value (§28).

`pnpm --filter core test -- runs/tiebreakers`
