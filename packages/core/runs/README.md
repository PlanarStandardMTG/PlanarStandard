# core/runs

Running an event on the site (plan §28, E26): pure functions from a run's entrants and
pairings to what happens next. No clock, no `Math.random`, no Supabase: randomness arrives
as the run's stored seed, so every pairing and every tie reproduces.

```
record          match and game points per entrant          MTR Appendix C
tiebreakers     opponents' match-win %, game-win %, OGW%   MTR §3.1, Appendix C
standings       the ordered Swiss standings                MTR §3.1
pair-swiss      the next Swiss round, no rematches         common practice
assign-bye      the lowest-ranked entrant without a bye    common practice
top-cut         single elimination, seeded and with drops  MTR §2.4, §2.10, §10.4
suggest-rounds  Swiss rounds and a top cut to prefill      MTR Appendix E
run-state       which state a run may move to, and why not
run-progress    the facts run-state judges a move by
run-details     an organizer's name, formats and structure
to-parsed-event a finished run, ready for ingest-event     ADR 006, ADR 015
seeded-random   the only randomness, from the run's seed
```

Scoring and standings follow the Magic Tournament Rules and each module cites its section.
Swiss pairing is common practice rather than MTR, which names the algorithm without
defining it (§10.4).
