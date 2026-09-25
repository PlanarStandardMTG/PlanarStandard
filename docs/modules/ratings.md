# How ratings work

**This file is the source for `/ratings-explained` (E17.13).** Everything
between the `publish:start` and `publish:end` markers is copied verbatim into
`content/pages/ratings-explained.mdx`; a test fails when the two disagree, and
`pnpm content:sync` resolves it.

Modules: `core/elo/expected-score`, `pick-k`, `apply-match`, `replay`, `rated-by-default` (E8).

---

<!-- publish:start -->

## The short version

Every player starts at **1500**. After each rated match, the two players' ratings
move toward or away from each other by an amount that depends on how surprising
the result was. Beating someone rated far above you moves your rating a lot;
beating someone far below you barely moves it at all.

## What counts as a rated match

Only **Monthly** events are rated. Every other event is still recorded, and
counts towards the metagame, but its matches never move a rating. An event is
treated as a Monthly when its name contains the word "Monthly"; an admin can
correct that for any single event.

A match only rates if the event reported **who played whom**. Standings alone are
not enough: an event that reports only final placements is recorded for metagame
purposes and marked **unrated** (ADR 006).

Pairings are never inferred from placements. Guessing who played whom would
silently corrupt every rating downstream, and a corrupted ladder is worse than a
short one.

Byes never move a rating — there is no opponent to be right or wrong about.
Elimination rounds count by default.

## The formula

Expected score for a player rated `Ra` against one rated `Rb`:

```
E = 1 / (1 + 10^((Rb - Ra) / 400))
```

A 400-point lead corresponds to a 10:1 expectation. After the match:

```
new rating = old rating + K x (actual - expected)
```

`actual` is 1 for a win, 0.5 for a draw, 0 for a loss. A **double loss** scores 0
for both players — it is a penalty, not a result, and neither player gains.

Both players' new ratings are computed from the ratings they held **before** the
match, so the order the two updates are written in cannot change the outcome.

## K factors

`K` controls how far one match can move a rating. It comes from the
admin-editable rating config, never from code:

| Tier        | K   | When                       |
| ----------- | --- | -------------------------- |
| Provisional | 40  | fewer than 5 rated matches |
| Standard    | 24  | the default                |
| Elite       | 16  | rating at or above 2100    |

Provisional is checked first. A new player who has climbed above 2100 in three
matches is still provisional — that rating has not been tested yet.

K is then multiplied by the event's weight. All events currently weigh 1.0;
the multiplier exists so that making a championship count more later is a data
change, not a deploy.

## Recompute, never adjust

Ratings are never edited. The whole ladder is **replayed from the match ledger**
every time anything changes — a correction, a new event, two handles merged into
one player (ADR 004). A rating is a function of the match history and the config,
and of nothing else.

This is what makes merges safe. The ledger records **handles, not people**
(ADR 003): a match says `"c0d33" beat "Brayzon" 2-1`, and who those handles
belong to is a separate mapping resolved at replay time. Binding two handles to
one player and re-running produces one merged rating **without changing a single
row in the match ledger**.

## Leaderboard eligibility

The leaderboard is **per season**: it replays only the current season's rated
matches, so it starts fresh when a new season opens.

A player is ranked once they are out of provisional and have played at least 5
rated matches — about one Monthly. Everyone rated this season who has not got
there yet is listed beneath the ranked table, unplaced. A player with no rated
match in 120 days is marked inactive.

## Anomalies

Replay never throws on bad data; it records it. Each run stores what it found:

| Anomaly                              | What happens                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Both sides are the same player       | the match is skipped                                                                                                        |
| A match id appears twice             | the repeat is skipped                                                                                                       |
| Game counts contradict the result    | recorded, and the match still applies — Elo reads the result, and a mis-keyed game count is no reason to discard a real one |
| A rating moved further than K allows | recorded; this is arithmetically impossible and means a bug, not bad data                                                   |

These are visible per rating run so they get corrected rather than accumulating.

<!-- publish:end -->
