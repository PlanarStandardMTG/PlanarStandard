-- E13.6 — tournaments.
--
-- §13 of the master plan. The ledger's spine: every match, entry and rating is
-- scoped to a row here.
--
-- Not to be confused with `external_events` (E23), which caches the Challonge
-- calendar so the site can advertise what is coming up. That table is a cache
-- the refresh deletes wholesale; this one is a record nothing may delete.

create type tournament_status as enum (
  'draft', 'awaiting_results', 'results_imported', 'verified', 'archived'
);

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  event_date date not null,
  season_id uuid references seasons (id),
  format_version_id uuid references format_versions (id),
  platform text,
  external_url text,
  structure text,
  rounds int,
  player_count int,
  -- What this event is worth to a rating. One by default; a championship can be
  -- weighted up without a second rating model (§12).
  weight numeric not null default 1.0,
  -- False until an import brings pairings. A standings-only event is recorded
  -- for metagame purposes and stays unrated (ADR 006).
  is_rated boolean not null default false,
  status tournament_status not null default 'draft',
  created_at timestamptz not null default now()
);

create index tournaments_season_date_idx on tournaments (season_id, event_date desc);
create index tournaments_date_idx on tournaments (event_date desc);

alter table tournaments enable row level security;

-- A draft tournament is an organizer's scratch pad — a date and a name before
-- anything has been played. The rest is public record.
create policy tournaments_public_read on tournaments for select using (status <> 'draft');
