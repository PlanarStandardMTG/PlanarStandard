-- E13.10 — identity_exclusions, merge_suggestions, player_merges.
--
-- §12 of the master plan. The curation half of the identity system: what can
-- never be merged, what might want merging, and what was merged.
--
-- All three are admin surface. None gets a read policy — see the bottom of this
-- file for why that differs from `match_corrections`, which is public.

-- Two handles in the same event are never the same person (E9.7, ADR 003).
--
-- The hardest fact in the identity system and the one that makes automatic
-- merging safe to attempt at all: whatever the signals say, nobody played
-- themselves. `score-candidates` zeroes any candidate covered by a row here and
-- `merge-players` refuses the merge outright.
create table identity_exclusions (
  identity_a uuid not null references player_identities (id) on delete cascade,
  identity_b uuid not null references player_identities (id) on delete cascade,
  -- Free text, not an enum: 'co_appearance' and 'admin_dismissed' are the two
  -- today and the vocabulary is expected to grow. A wrong value here costs a
  -- report, not an exclusion — the pair is still excluded either way.
  reason text not null,
  -- Which event proved it, for a co-appearance. Null for an admin dismissal.
  tournament_id uuid references tournaments (id),

  primary key (identity_a, identity_b),
  -- One row per pair, not two. `core/identity/co-appearance-exclusions` already
  -- emits ordered pairs and says it does so because of this constraint; without
  -- it the primary key would let (A,B) and (B,A) both exist and every lookup
  -- would have to try both ways round.
  --
  -- The orders agree: core sorts the canonical lowercase hyphenated text, and
  -- Postgres compares the 16 bytes, which for that spelling is the same order.
  constraint identity_exclusions_ordered_pair check (identity_a < identity_b)
);

create index identity_exclusions_b_idx on identity_exclusions (identity_b);

-- What the signals think might be one person (E9.8, E18.17).
--
-- A suggestion, never an action. Merging is E18.16 and always has a human on it,
-- because a wrong merge silently fuses two people's ratings and the evidence for
-- undoing it is `player_merges.moved` rather than anything here.
create table merge_suggestions (
  id uuid primary key default gen_random_uuid(),
  player_a uuid not null references players (id) on delete cascade,
  player_b uuid not null references players (id) on delete cascade,
  confidence numeric not null,
  -- The `Signal[]` that produced the confidence, stored so a reviewer sees why
  -- rather than only how much.
  evidence jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'merged', 'dismissed', 'stale')),
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,

  unique (player_a, player_b),
  -- Canonical order, as with the exclusions above. §12 does not specify this and
  -- it is here because without it the unique constraint does not mean what it
  -- reads as: (A,B) and (B,A) would be two rows, and an admin would review the
  -- same pair twice.
  constraint merge_suggestions_ordered_pair check (player_a < player_b)
);

create index merge_suggestions_pending_idx
  on merge_suggestions (confidence desc) where status = 'pending';

-- What was merged, and what moved when it was.
--
-- `moved` is the whole reason this table exists: it records which identities and
-- which rows were repointed, so a merge can be undone. A merge with no record of
-- what it touched is not reversible, and reversibility is the acceptance
-- criterion on E18.16.
create table player_merges (
  id uuid primary key default gen_random_uuid(),
  winner_id uuid not null references players (id),
  loser_id uuid not null references players (id),
  reason text,
  moved jsonb not null,
  merged_by uuid references profiles (id),
  created_at timestamptz not null default now(),

  -- Merging somebody into themselves is a no-op that leaves an audit row saying
  -- a merge happened. §12 does not specify this; it costs nothing and the row it
  -- prevents is one that would have to be explained later.
  constraint player_merges_distinct_players check (winner_id <> loser_id)
);

create index player_merges_winner_idx on player_merges (winner_id);
create index player_merges_loser_idx on player_merges (loser_id);

alter table identity_exclusions enable row level security;
alter table merge_suggestions enable row level security;
alter table player_merges enable row level security;

-- No read policy on any of the three, deliberately, and this is the one place
-- that decision differs from `match_corrections` — which is public precisely so
-- a rating that moved can be explained to the person it moved.
--
-- The difference is what the row is about. A correction is about an event's
-- data. These are assertions about *people*: that two handles are one person, or
-- that somebody suspected they were. `players.visibility = 'hidden'` exists
-- because not everyone wants to be listed at all, and publishing "these two
-- accounts are the same person" would route around that.
--
-- Admin-only access is E14.4.
