-- E13.5 — players and player_identities.
--
-- §12 of the master plan, and ADR 003, which is the decision this table pair
-- exists to hold: **the ledger records handles, not people.** A match points at
-- a `player_identities` row, never at a `players` row, so merging two handles
-- produces one merged rating without rewriting a single row of history.

create type player_visibility as enum ('public', 'hidden');

create table players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  slug text unique not null,
  -- Set when someone signs in and claims the player. Most players never do:
  -- identities auto-create from imports and curation is merging, not claiming
  -- (ADR 009).
  profile_id uuid unique references profiles (id) on delete set null,
  visibility player_visibility not null default 'public',
  -- A merge points the loser here rather than deleting it, so an old link and an
  -- old rating_event both still resolve.
  merged_into uuid references players (id),
  created_at timestamptz not null default now()
);

create type identity_platform as enum ('discord', 'challonge', 'melee', 'mtgo', 'arena', 'manual');
create type identity_source as enum (
  'import_inferred', 'admin_assigned', 'discord_oauth', 'organizer_entered'
);

create table player_identities (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id) on delete cascade,
  platform identity_platform not null,
  handle text not null,
  -- Generated, not written. `Zaunus13`, `zaunus_13` and `Zaunus 13` are one
  -- handle on one platform, and the uniqueness below has to hold against what
  -- the sources actually send rather than against what they ought to.
  normalized text generated always as (lower(regexp_replace(handle, '[^a-zA-Z0-9]', '', 'g'))) stored,
  source identity_source not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  -- Per platform, not globally: the same string on Discord and on Challonge is
  -- routinely two different people.
  unique (platform, normalized)
);

create index player_identities_player_idx on player_identities (player_id);
create index players_merged_into_idx on players (merged_into) where merged_into is not null;

alter table players enable row level security;
alter table player_identities enable row level security;

-- A hidden player is one who asked not to appear; their matches still rate, they
-- just do not show. Merged-away rows are history, not a second entry.
create policy players_public_read on players
  for select using (visibility = 'public' and merged_into is null);

-- Handles are public tournament handles — they were printed in the pairings.
create policy player_identities_public_read on player_identities
  for select using (exists (
    select 1 from players
    where players.id = player_identities.player_id
      and players.visibility = 'public'
      and players.merged_into is null
  ));
