# expected-score

**Purpose.** The Elo expectation for one player against one opponent.

**Inputs.** Two ratings.

**Outputs.** A number in `(0, 1)`.

**Gotchas.** The 400 scale constant is part of the Elo definition, not a knob —
that is why it is hard-coded here while every K factor and threshold comes from
`RatingConfig`. `expectedScore(a, b) + expectedScore(b, a) === 1` always, which
is what makes `apply-match` zero-sum.

`pnpm --filter core test -- expected-score`
