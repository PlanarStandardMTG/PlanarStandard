-- E13.11 — ratings, and the leaderboard view.
--
-- §12 of the master plan. Where `core/elo` writes.
--
-- Everything in this file except `rating_config` is **derived and recomputable**
-- (ADR 004). A full replay truncates `rating_events` and `player_ratings` and
-- rebuilds them from `matches`; no rating is ever uploaded, incremented in
-- place, or hand-edited. If a number here disagrees with the ledger, the ledger
-- is right and this is stale.

-- One row, forever.
--
-- Every threshold and every K that `core/elo` needs is reachable from here and
-- none of them is hard-coded (E8.2), because the whole point is that the rating
-- model can be retuned by an admin and re-run, rather than by a deploy. The
-- `check (id = 1)` is what makes "the config" a thing you can read without
-- deciding which one you meant.
create table rating_config (
  id int primary key default 1 check (id = 1),
  initial_rating int not null default 1500,
  k_provisional int not null default 40,
  k_standard int not null default 24,
  k_elite int not null default 16,
  -- Rated matches before a player leaves provisional K (E8.6).
  provisional_matches int not null default 15,
  elite_threshold int not null default 2100,
  min_matches_for_leaderboard int not null default 10,
  -- Days without a rated match before `is_active` goes false (E8.6).
  inactive_after_days int not null default 120,
  -- A bye is not a win against anybody, so by default it rates nothing.
  count_byes boolean not null default false,
  count_elimination_rounds boolean not null default true
);

insert into rating_config (id) values (1);

-- The per-player, per-match audit trail a replay emits.
--
-- This is what makes a rating explainable: every row says what the rating was,
-- what it became, what was expected, and which K applied. A leaderboard without
-- this is a number nobody can argue with, which on a community site is the same
-- as a number nobody trusts.
create table rating_events (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id) on delete cascade,
  match_id uuid not null references matches (id) on delete cascade,
  tournament_id uuid not null references tournaments (id) on delete cascade,
  -- Null on a bye, and on a match whose opponent did not resolve.
  opponent_id uuid references players (id),
  event_date date not null,
  rating_before numeric not null,
  rating_after numeric not null,
  expected_score numeric not null,
  actual_score numeric not null,
  -- Already multiplied by the tournament weight (E8.2), so a past run stays
  -- readable after somebody changes the weight.
  k_factor numeric not null,
  -- This player's nth rated match, from 1 — what `pick-k` compares against
  -- `provisional_matches`.
  match_number int not null,

  -- One event per player per match. A replay that produced two would be
  -- double-counting, which is the failure mode `replay` reports as a
  -- `duplicate-match-id` anomaly (E8.5) rather than silently applying twice.
  unique (player_id, match_id)
);

create index rating_events_player_date_idx on rating_events (player_id, event_date);
create index rating_events_match_idx on rating_events (match_id);

-- The current standing of every rated player. Every column is derived by replay.
create table player_ratings (
  player_id uuid primary key references players (id) on delete cascade,
  rating numeric not null,
  peak_rating numeric not null,
  matches_played int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,
  tournaments_played int not null default 0,
  -- Null until a rated match lands, so `is_active` has nothing to measure yet.
  last_played date,
  is_provisional boolean not null default true,
  is_active boolean not null default true
);

create index player_ratings_rating_idx on player_ratings (rating desc);

-- One row per replay. The log that answers "why did the leaderboard change".
--
-- `anomalies` is where self-play, duplicate matches, impossible game counts and
-- rating jumps land. Replay returns them as data and does not throw (E8.5): a
-- recompute that stopped on the first bad row would leave the site with no
-- ratings at all rather than with ratings and a list of things to look at.
create table rating_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null,
  match_count int,
  player_count int,
  duration_ms int,
  anomalies jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index rating_runs_created_idx on rating_runs (created_at desc);

alter table rating_config enable row level security;
alter table rating_events enable row level security;
alter table player_ratings enable row level security;
alter table rating_runs enable row level security;

-- The model is published at `/ratings-explained`, generated from
-- `docs/modules/ratings.md`. The numbers it describes have to be readable or the
-- page is describing something nobody can check.
create policy rating_config_public_read on rating_config for select using (true);

-- A rating and its history are public for a public player, and follow that
-- player's visibility exactly. A hidden player still rates — their matches still
-- move everyone else's numbers — they simply do not appear.
create policy player_ratings_public_read on player_ratings
  for select using (exists (
    select 1 from players
    where players.id = player_ratings.player_id
      and players.visibility = 'public'
      and players.merged_into is null
  ));

create policy rating_events_public_read on rating_events
  for select using (exists (
    select 1 from players
    where players.id = rating_events.player_id
      and players.visibility = 'public'
      and players.merged_into is null
  ));

-- No policy on `rating_runs`. It is an operator's log, and its `anomalies`
-- name players in the context of something having gone wrong with their data.
-- Admin access is E14.4.

-- Who appears on the leaderboard, and the only place that question is answered.
--
-- `security_invoker` matters: without it the view would run as its owner and
-- read straight past the policies above, so a hidden player would reappear here
-- even though every underlying table hides them. The view's own `where` clause
-- already excludes them — this is the belt to that's braces, and it is the half
-- that keeps working if somebody edits the clause.
--
-- The threshold is read from `rating_config` rather than written here, so
-- raising it is an admin edit and not a migration.
create view leaderboard with (security_invoker = true) as
select
  p.id,
  p.slug,
  p.display_name,
  r.rating,
  r.peak_rating,
  r.matches_played,
  r.wins,
  r.losses,
  r.draws,
  r.tournaments_played,
  r.last_played,
  r.is_active
from player_ratings r
join players p on p.id = r.player_id
where p.visibility = 'public'
  and p.merged_into is null
  and not r.is_provisional
  and r.matches_played >= (select min_matches_for_leaderboard from rating_config where id = 1);
