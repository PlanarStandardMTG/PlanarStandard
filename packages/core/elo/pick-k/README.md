# pick-k

**Purpose.** The K factor for one player in one match.

**Inputs.** The player's pre-match `matchesPlayed` and `rating`, the
`RatingConfig`, and the tournament weight.

**Outputs.** A number — the tier's K multiplied by the weight.

**Gotchas.** Provisional is tested **before** elite: a player with fewer than
`provisionalMatches` rated matches is provisional regardless of how high their
rating has climbed, because that rating has not been tested yet. Every threshold
is read from `RatingConfig` and none is hard-coded, so retuning the ladder is an
admin edit rather than a deploy. Event weighting is flat (1.0) today but the
multiplier is applied here so making a championship count more never touches
`apply-match` (Part IX, answer 7).

`pnpm --filter core test -- pick-k`
