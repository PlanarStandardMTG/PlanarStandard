# core/runs

Running an event on the site (plan §28, E26): pure functions from a run's entrants and
pairings to what happens next. No clock, no `Math.random`, no Supabase: randomness arrives
as the run's stored seed, so every pairing and every tie reproduces.

```
record          match and game points per entrant          MTR Appendix C
tiebreakers     opponents' match-win %, game-win %, OGW%   MTR §3.1, Appendix C
standings       the ordered Swiss standings                MTR §3.1
assign-bye      the lowest-ranked entrant without a bye     common practice
seeded-random   the only randomness, from the run's seed
```

Scoring and standings follow the Magic Tournament Rules and each module cites its section.
Swiss pairing is common practice rather than MTR, which names the algorithm without
defining it (§10.4).
