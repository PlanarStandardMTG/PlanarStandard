# rated by default

**Purpose.** Whether a newly imported tournament feeds Elo, judged from its name.

**Inputs.** The tournament's name, as the source reported it.

**Outputs.** A boolean that seeds `tournaments.is_rated`.

**Gotchas.** Only Monthlies are rated, matched on the whole word so "Mid-Month
Madness" stays unrated. It is only the starting value: an admin can flip
`is_rated` afterwards (E20.34), and the rating recompute reads the column, never
this function.

`pnpm --filter core test -- rated-by-default`
