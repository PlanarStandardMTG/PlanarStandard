# Indexes

_E13.14. What each index on the schema is for, which queries depend on it, and
the plans that show it is being used._

Every index lives in the migration that created its table, next to a comment
saying why. This page is the review across all of them, and the record of the
measurement — a plan taken once and written down is worth more than an assertion
that something is fast.

## How these were measured

Against a local Supabase, inside a transaction that was rolled back, over
synthetic volume roughly two seasons past where the site is today: **4,000 rated
players**, **30,000 matches**, **60,000 rating events** and **40,000 card-stat
rows**. Small numbers by database standards, and deliberately so — this is a
community format, and an index review that plans for a million rows would be
designing for a site that does not exist.

Reproduce with `explain (analyze, buffers, costs off)` against the same shapes.
Note that `analyze` must be run after the inserts; without it the planner is
working from statistics that describe an empty table and every plan is a guess.

## The hot queries, and what they use

### The leaderboard

`getLeaderboard` reads the view, ordered by rating.

```
Incremental Sort  (rows=100)
  Sort Key: r.rating DESC, p.slug
  Presorted Key: r.rating
  ->  Nested Loop
        ->  Index Scan using player_ratings_rating_idx on player_ratings r
              Filter: ((NOT is_provisional) AND (matches_played >= min_matches_for_leaderboard))
              Rows Removed by Filter: 42
        ->  Index Scan using players_pkey on players p
              Filter: ((merged_into IS NULL) AND (visibility = 'public'))
Execution Time: 0.440 ms
```

`player_ratings_rating_idx` supplies the order, so the top hundred is a hundred
index rows rather than a sort of four thousand. The two eligibility filters are
applied after the index scan — reading 144 rows to return 100.

**When to revisit.** That ratio is the thing to watch. It holds while most rated
players qualify; if provisional and below-threshold players ever became the
majority, the scan would read most of the table to fill one page, and the answer
would be a partial index on the qualifying predicate. `min_matches_for_leaderboard`
is admin-editable, so raising it is the change most likely to cause this.

### Card statistics for a season

`listCardStats`, the table behind every "most played" list.

```
Limit  (rows=50)
  ->  Incremental Sort
        Sort Key: inclusion_rate DESC, oracle_id
        Presorted Key: inclusion_rate
        ->  Index Scan using card_stats_season_inclusion_idx on card_stats
              Index Cond: ((season_id = ...) AND (board = 'main'))
Execution Time: 0.137 ms
```

`card_stats_season_inclusion_idx` is `(season_id, board, inclusion_rate desc)` and
covers the whole query: both equalities and the ordering. Only the `oracle_id`
tiebreak needs a sort, and only within groups of equal rate.

### One player's rating history

`listRatingHistory`, which `RatingHistory` plots.

```
Incremental Sort
  Sort Key: event_date, match_number
  Presorted Key: event_date
  ->  Index Scan using rating_events_player_date_idx on rating_events
        Index Cond: (player_id = ...)
Execution Time: 0.225 ms
```

`rating_events_player_date_idx` is `(player_id, event_date)`, so the date order
comes out of the index and only the within-day `match_number` is sorted. At 60,000
rating events one player's history is 41 buffers.

### One tournament's matches

`listMatchesByTournament`.

```
Index Scan using matches_tournament_idx on matches  (rows=30000)
  Index Cond: (tournament_id = ...)
Execution Time: 12.406 ms
```

12 ms is for a deliberately absurd 30,000-match event; a real one is thirty to
three hundred rows. The point of the plan is that the index is used and the cost
is linear in the event, not in the ledger.

## Two sequential scans that are correct

An index review that adds an index everywhere a `Seq Scan` appears has not
reviewed anything. Both of these were measured and both are right as they are.

### `matchup_stats`, either side of the pair

`listMatchupsForArchetype` filters `archetype_a = x or archetype_b = x`, and the
planner ignores both the primary key and `matchup_stats_b_idx`:

```
Seq Scan on matchup_stats  (rows=4)
  Filter: ((season_id = ...) AND ((archetype_a = ...) OR (archetype_b = ...)))
  Rows Removed by Filter: 26
Execution Time: 0.050 ms
```

Correct, because the table is small **by construction**: one row per unordered
pair of archetypes per season, so thirty archetypes is 435 rows and a hundred is
4,950. The whole table fits in a handful of pages and reading it beats two index
scans and a bitmap. `matchup_stats_b_idx` earns its place on the single-cell
lookup, not here.

### `posts` by author

The GDPR export (`listPostsByAuthor`) filters on `author_id`, which no index
covers:

```
Seq Scan on posts
  Filter: (author_id = ...)
Execution Time: 0.046 ms
```

`posts` is a table an ambassador adds to a few times a week and the query runs
when somebody downloads their own data. Indexing `author_id` would cost a write on
every publish to save nothing measurable. `decks.owner_id` is the same shape and
the same answer.

**When to revisit.** Either, once the table passes a few thousand rows and the
query is on a page rather than in an export.

## Every index, and what it is for

| Table                 | Index                                                 | Serves                                             |
| --------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| `posts`               | `posts_published_idx` (partial)                       | the feed — published only, newest first            |
| `posts`               | `posts_kind_published_idx` (partial)                  | `/news` and `/community` separately                |
| `post_revisions`      | `post_revisions_post_idx`                             | one post's history                                 |
| `external_events`     | `external_events_source_starts_idx`                   | the calendar, per source                           |
| `format_versions`     | `format_versions_one_current` (unique, partial)       | one current version, enforced not asserted         |
| `archetype_aliases`   | `archetype_aliases_archetype_idx`                     | an archetype's aliases                             |
| `archetypes`          | `archetypes_parent_idx` (partial)                     | the supertype tree                                 |
| `seasons`             | `seasons_one_current` (unique, partial)               | one current season, enforced not asserted          |
| `tournaments`         | `tournaments_season_date_idx`                         | a season's events, newest first                    |
| `tournaments`         | `tournaments_date_idx`                                | the home page and the calendar                     |
| `players`             | `players_merged_into_idx` (partial)                   | finding what merged into a player                  |
| `player_identities`   | `player_identities_player_idx`                        | a player's handles                                 |
| `player_identities`   | `(platform, normalized)` (unique)                     | resolving a handle on import — the hot import path |
| `decks`               | `decks_season_idx`, `decks_player_idx` (partial)      | a season's decks; a player's decks                 |
| `deck_cards`          | `deck_cards_deck_idx`, `deck_cards_oracle_idx`        | a decklist; every deck running a card              |
| `result_imports`      | `result_imports_tournament_status_idx`                | the import queue for an event                      |
| `staged_matches`      | `staged_matches_import_idx`                           | the review screen                                  |
| `matches`             | `matches_tournament_idx`                              | one event's ledger, by round                       |
| `matches`             | `matches_p1_idx`, `matches_p2_idx` (partial)          | the replay, which walks by identity                |
| `match_corrections`   | `match_corrections_match_idx`                         | a match's correction trail                         |
| `tournament_entries`  | `tournament_entries_placement_idx`                    | the podium                                         |
| `tournament_entries`  | `tournament_entries_player_idx`                       | a player's events                                  |
| `identity_exclusions` | `identity_exclusions_b_idx`                           | the second half of an ordered pair                 |
| `merge_suggestions`   | `merge_suggestions_pending_idx` (partial)             | the review queue, most confident first             |
| `player_merges`       | `player_merges_winner_idx`, `player_merges_loser_idx` | undoing a merge from either end                    |
| `rating_events`       | `rating_events_player_date_idx`                       | one player's history                               |
| `rating_events`       | `rating_events_match_idx`                             | explaining one match's effect                      |
| `player_ratings`      | `player_ratings_rating_idx`                           | the leaderboard's order                            |
| `rating_runs`         | `rating_runs_created_idx`                             | recompute health, newest first                     |
| `card_stats`          | `card_stats_season_inclusion_idx`                     | most-played, per season and board                  |
| `deck_similarity`     | `deck_similarity_b_idx`                               | every edge touching a deck — the other half        |
| `matchup_stats`       | `matchup_stats_b_idx`                                 | one matchup cell from B's side                     |

Primary keys and unique constraints index themselves and are not repeated here,
except where the index is doing work the constraint is incidental to.

## The three partial-index patterns, and why

- **`where <predicate>` on a nullable column** — `players_merged_into_idx`,
  `decks_player_idx`, `matches_p2_idx`. Most rows are null (most players are not
  merged, most decks have no player, no bye has an opponent), and indexing the
  nulls would be indexing the answer nobody asks for.
- **`where status = 'published'`** — the feed never asks for a draft, so the index
  is the size of the published set rather than of the table.
- **`unique ... where is_current`** — one current season and one current format
  version, enforced by the database rather than asserted by a job. A second
  current row is a failed insert, not a page that renders two.
