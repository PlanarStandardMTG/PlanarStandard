# How ratings work

**This file is the source for `/ratings-explained` (E17.13).** Everything
between the `publish:start` and `publish:end` markers is copied verbatim into
`content/pages/ratings-explained.mdx`; a test fails when the two disagree, and
`pnpm content:sync` resolves it.

Modules: `core/elo/expected-score`, `pick-k`, `apply-match`, `replay`, `rated-by-default` (E8).

---

<!-- publish:start -->

## The short version

Everyone starts at **1000**. Each rated match moves both players' ratings by an
amount that depends on how surprising the result was.

## What counts

Only **Monthly** events are rated: events with "Monthly" in the name, which an
admin can override. Other events still count for the metagame.

A match is rated only if the event reports **who played whom**. Pairings are never
guessed from standings (ADR 006). Byes never count; elimination rounds do.

## The formula

```
E = 1 / (1 + 10^((Rb - Ra) / 400))
new rating = old rating + K x (actual - expected)
```

`actual` is 1 for a win, 0.5 for a draw, 0 for a loss. A double loss scores 0 for
both. Both updates use the ratings from before the match.

## K factor

Every match uses **K = 32**. There are no placement matches: everyone enters the
format on equal footing, so a first match moves a rating by the same K as any
other. K is multiplied by the event's weight, currently 1.0 for all events.
Admins can change these settings.

## Recalculated, never edited

The whole ladder is replayed from match results whenever anything changes
(ADR 004). Results are stored against handles, not people (ADR 003), so linking
two handles to one player merges their ratings without changing any results.

## Leaderboard

The leaderboard covers the rated events between two dates an admin sets, both
included; with no end date it runs to the newest event. A player appears on it
once they have played in 2 or more rated events, counting ones before the start
date, so a returning player is ranked from their first event in it. A bye is not playing. Before that they
have a rating but no place.

## Anomalies

Bad data is recorded per rating run, not thrown away silently: a player matched
against themselves or a repeated match is skipped; a game count that contradicts
the result is flagged but still applied; a rating change larger than K is flagged
as a bug.

<!-- publish:end -->
