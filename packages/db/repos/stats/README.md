# `repos/stats`

**Purpose.** Read and write the six derived-statistics tables (E13.21):
`deck_metrics`, `card_stats`, `archetype_stats`, `deck_similarity`,
`deck_map_layout` and `matchup_stats`. The reads are what every E19 chart is
drawn from; the writes are what a recompute does at the end.

**Inputs.** A `SupabaseClient`. The reads take the public client. The writes take
the **service-role** client because they have to: none of these tables has a
write policy for anybody, which is ADR 008 expressed as an absence (E14.2).

**Outputs.** `DeckMetrics`, `CardStats`, `ArchetypeStats`, `SimilarityEdge`,
`LayoutPoint` and `MatchupStats` from `@ps/contracts`. The snake_case row shape
does not leave `rows.ts`.

**Gotchas.**

- **Nothing here holds an input.** Every row is produced by a recompute reading
  `matches`, `decks` and `tournament_entries`. If a number here disagrees with the
  ledger, the ledger is right and this is stale — which is why dropping the lot
  and re-running is always a safe repair.
- **The writes replace a season wholesale.** A recompute is a full rebuild
  (ADR 004), so there is no function here that moves one number. Seasons are
  replaced independently, because they are: recomputing Season II must not clear
  Season I. `upsertDeckMetrics` is the exception and keyed by deck, since a deck's
  metrics depend only on that deck.
- **No function here suppresses anything.** A stored rate arrives with the `n` it
  came from and the caller renders the pair through `core/stats/suppress-small-n`
  (ADR 012, E10.3). Suppressing at this layer would hand the UI a missing rate
  with no way to say why.
- **`listMatchupsForArchetype` asks about both sides.** The pair is ordered, so an
  archetype is `archetype_a` in some rows and `archetype_b` in the rest; filtering
  on one column is half an answer.
- Both pair tables want ordered pairs (`deck_a < deck_b`,
  `archetype_a < archetype_b`) — check constraints, and without them an
  undirected edge stored twice is an edge counted twice by anything walking the
  graph.
- **`replaceLayout` is wholesale and never point by point.** The coordinates are
  one run of a seeded force simulation; half of one layout against half of another
  is a map of nothing.
- **Every `numeric` goes through `Number`,** and a null stays null.
  `Number(null)` is `0`, and a rate that is missing because nobody has played the
  matchup is not a rate of zero.
- Three of the six follow their deck's visibility rather than being public, so a
  private deck's metrics, its dot on the map and its edges all read as absent
  through the public client. The recompute jobs skip private decks anyway; the
  policy is what holds if one ever forgets.

`pnpm --filter db test -- repos/stats`
