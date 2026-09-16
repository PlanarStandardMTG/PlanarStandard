-- E13.12 — derived statistics.
--
-- §15 of the master plan. Six tables, and **not one of them holds an input**.
--
-- Every row here is produced by a recompute reading `matches`, `decks` and
-- `tournament_entries`, and every recompute is a full rebuild rather than an
-- increment (ADR 004). Nothing is ever uploaded here, and nothing is ever edited
-- by hand. If a number in this file disagrees with the ledger, the ledger is
-- right and this is stale — which is why dropping the lot and re-running is
-- always a safe repair.
--
-- Two shapes recur and both are deliberate:
--
--   * **Every rate is stored with its `n`.** `win_rate` next to `game_wins` and
--     `game_losses`, `inclusion_rate` next to `decks_including`. Any
--     user-visible rate goes through `suppress-small-n` and shows its `n`, and a
--     rate stored without the count it came from cannot be suppressed or
--     explained downstream.
--   * **`by_event jsonb`** is the same statistic over time, for the sparklines
--     and the share-over-time charts. Denormalized on purpose: reconstructing it
--     per request from the ledger is the query that makes a metagame page slow.

-- One row per deck. `compute-deck-metrics` (E6.7) writes it.
create table deck_metrics (
  deck_id uuid primary key references decks (id) on delete cascade,
  maindeck_count int not null,
  sideboard_count int not null,
  avg_mv_incl_lands numeric,
  avg_mv_excl_lands numeric,
  avg_mv_sideboard numeric,
  total_mv numeric,
  mv_buckets jsonb not null,
  color_counts jsonb not null,
  color_identity text[],
  type_counts jsonb not null,
  -- Keyed by the card's **legal** set, never its printed one: `Llanowar Elves
  -- (M19)` counts under FDN (`core/metrics/set-attribution`, E6.4).
  set_counts jsonb not null,
  rarity_counts jsonb not null,
  -- A deck with unresolved cards still gets metrics; the count is what tells a
  -- reader the numbers are incomplete, and what excludes it from `card_stats`
  -- until somebody fixes it (E18.10).
  unresolved_cards int not null default 0,
  computed_at timestamptz not null default now()
);

-- One row per card, per season, per board.
create table card_stats (
  season_id uuid not null references seasons (id) on delete cascade,
  -- No foreign key: there is no `cards` table to point at. Card data is a repo
  -- artifact (§14.1) and integrity is `dataset-integrity.test.ts`'s job.
  oracle_id uuid not null,
  -- Two boards, not the three `deck_cards` allows. The command zone is not part
  -- of the inclusion statistics this site publishes, and a `command` row here
  -- would quietly widen every "played in N% of decks" number.
  board text not null check (board in ('main', 'side')),
  decks_including int not null,
  total_copies int not null,
  avg_copies numeric not null,
  inclusion_rate numeric not null,
  primary_archetype_id uuid references archetypes (id),
  archetype_breakdown jsonb not null,
  game_wins int not null,
  game_losses int not null,
  -- Null under the threshold. The label this renders under is "win rate of decks
  -- including this card" and never "win rate of this card" (E19.8) — the number
  -- does not know which cards won the game.
  win_rate numeric,
  by_event jsonb not null,

  primary key (season_id, oracle_id, board)
);

create index card_stats_season_inclusion_idx
  on card_stats (season_id, board, inclusion_rate desc);

-- One row per archetype, per season.
create table archetype_stats (
  season_id uuid not null references seasons (id) on delete cascade,
  archetype_id uuid not null references archetypes (id) on delete cascade,
  deck_count int not null,
  share_of_supertype numeric not null,
  share_of_field numeric not null,
  round_wins int not null,
  round_losses int not null,
  round_draws int not null,
  game_wins int not null,
  game_losses int not null,
  game_win_rate numeric,
  round_win_rate numeric,
  -- From `core/stats/wilson`. Stored rather than computed at render time so the
  -- interval a chart drew can be reproduced from the row that drew it.
  wilson_low numeric,
  wilson_high numeric,
  by_event jsonb not null,

  primary key (season_id, archetype_id)
);

-- The edges of the archetype map (E7.3).
create table deck_similarity (
  season_id uuid not null references seasons (id) on delete cascade,
  deck_a uuid not null references decks (id) on delete cascade,
  deck_b uuid not null references decks (id) on delete cascade,
  similarity numeric not null,
  shared_cards int not null,

  primary key (season_id, deck_a, deck_b),
  -- One row per pair, as with `identity_exclusions`. An undirected edge stored
  -- twice is an edge counted twice by anything that walks the graph.
  check (deck_a < deck_b)
);

-- "Every edge touching this deck" needs both ends. The primary key indexes
-- `deck_a` and nothing indexes `deck_b`, which is half a graph.
create index deck_similarity_b_idx on deck_similarity (season_id, deck_b);

-- Where each deck sits on the map. Server-computed, because the layout is seeded
-- and must be reproducible run to run (`core/similarity/force-layout`, E7.4) —
-- a map that rearranges itself on every page load is unreadable.
create table deck_map_layout (
  season_id uuid not null references seasons (id) on delete cascade,
  deck_id uuid not null references decks (id) on delete cascade,
  x numeric not null,
  y numeric not null,
  -- Bumped when the layout algorithm changes, so a cached image and the
  -- coordinates behind it cannot silently disagree.
  layout_version int not null default 1,

  primary key (season_id, deck_id)
);

-- Archetype against archetype (E10.x, E19.11).
create table matchup_stats (
  season_id uuid not null references seasons (id) on delete cascade,
  archetype_a uuid not null references archetypes (id),
  archetype_b uuid not null references archetypes (id),
  matches int not null,
  a_match_wins int not null,
  b_match_wins int not null,
  match_draws int not null,
  a_game_wins int not null,
  b_game_wins int not null,
  -- A's rate, and the interval around it. B's is not stored: it is derivable,
  -- and two stored rates for one matchup is two chances to disagree.
  a_win_rate numeric,
  wilson_low numeric,
  wilson_high numeric,

  primary key (season_id, archetype_a, archetype_b),
  -- Ordered pair, so the matrix has one cell per matchup and reads it the same
  -- way from either side.
  check (archetype_a < archetype_b)
);

create index matchup_stats_b_idx on matchup_stats (season_id, archetype_b);

alter table deck_metrics enable row level security;
alter table card_stats enable row level security;
alter table archetype_stats enable row level security;
alter table deck_similarity enable row level security;
alter table deck_map_layout enable row level security;
alter table matchup_stats enable row level security;

-- The aggregates are the site. "Every number on this site is computed from data
-- you can read" is the promise in the footer, and these are the numbers.
create policy card_stats_public_read on card_stats for select using (true);
create policy archetype_stats_public_read on archetype_stats for select using (true);
create policy matchup_stats_public_read on matchup_stats for select using (true);

-- The other three name individual decks, so they follow that deck's visibility
-- rather than being public outright. A private deck's mana curve, or its dot on
-- the map, would disclose that the deck exists and roughly what is in it — which
-- is the whole of what `private` is for.
--
-- The recompute jobs are expected to skip private decks anyway. This is what
-- holds if one of them ever forgets.
create policy deck_metrics_public_read on deck_metrics
  for select using (exists (
    select 1 from decks where decks.id = deck_metrics.deck_id and decks.visibility <> 'private'
  ));

create policy deck_map_layout_public_read on deck_map_layout
  for select using (exists (
    select 1 from decks where decks.id = deck_map_layout.deck_id and decks.visibility <> 'private'
  ));

-- Both ends, not either: an edge is only publishable if both decks it joins are.
create policy deck_similarity_public_read on deck_similarity
  for select using (
    exists (select 1 from decks where decks.id = deck_similarity.deck_a
              and decks.visibility <> 'private')
    and exists (select 1 from decks where decks.id = deck_similarity.deck_b
                  and decks.visibility <> 'private')
  );
