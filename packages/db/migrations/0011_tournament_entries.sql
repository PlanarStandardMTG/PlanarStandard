-- E13.9 — tournament_entries.
--
-- §13 of the master plan. One row per person per event: where they finished,
-- what they registered, and what the source said their record was.
--
-- **This references `players`, and `matches` references `player_identities`.**
-- The difference is deliberate and is the whole reason both tables exist.
--
-- A match is raw history. It records the handles that appeared in the pairings,
-- so a merge repoints identities and rewrites nothing (ADR 003). An entry is a
-- resolved standing — "this person finished fourth" — and a person cannot finish
-- fourth and ninth at the same event.
--
-- Which makes `unique (tournament_id, player_id)` more than a tidiness
-- constraint: it is the co-appearance rule (E9.7) enforced by the database. Two
-- handles that both entered one event are two people, and a merge that would
-- collide here is a merge that must be refused. The service checks that first
-- and gives a readable error (E18.16); this is what catches it if the service
-- ever forgets.

create table tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  player_id uuid not null references players (id),
  -- Null when nobody registered a list, which is most events before decklists
  -- were collected and every standings-only import (ADR 006).
  deck_id uuid references decks (id),
  -- Denormalized from the deck on purpose: a backfilled entry can carry the
  -- archetype the organiser recorded even when the decklist itself is gone.
  archetype_id uuid references archetypes (id),
  -- Null when the source reported no standings — a matches-only import knows who
  -- played and not who won.
  placement int check (placement is null or placement > 0),
  match_wins int default 0,
  match_losses int default 0,
  match_draws int default 0,
  game_wins int default 0,
  game_losses int default 0,
  dropped boolean not null default false,
  -- Why there is no deck, in the organiser's words. A deck that is absent for a
  -- known reason and one nobody has got round to entering look identical without
  -- this, and only the second is worth chasing.
  deck_missing_reason text,

  unique (tournament_id, player_id)
);

-- The podium query: this event's entries, best first. Ordering by an unindexed
-- column is fine at thirty entries and is the top of the home page, so it is
-- worth the index rather than worth measuring later.
create index tournament_entries_placement_idx
  on tournament_entries (tournament_id, placement) where placement is not null;

-- "Every event this player has been to" — a player page, and the temporal
-- identity signal (E9.5).
create index tournament_entries_player_idx on tournament_entries (player_id);

alter table tournament_entries enable row level security;

-- Public wherever its tournament is, matching `matches`. Standings are the most
-- public thing an event produces — they were printed on the bracket page.
create policy tournament_entries_public_read on tournament_entries
  for select using (exists (
    select 1 from tournaments
    where tournaments.id = tournament_entries.tournament_id
      and tournaments.status <> 'draft'
  ));
