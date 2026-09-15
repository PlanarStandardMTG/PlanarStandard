-- E13.4 — seasons.
--
-- §13 of the master plan. A season is the unit every leaderboard and metagame
-- report is scoped to, and it names the format version it was played under so a
-- mid-season B&R change does not rewrite what was legal in week one.

create table seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ordinal int not null unique,
  starts_on date not null,
  ends_on date,
  format_version_id uuid references format_versions (id),
  is_current boolean not null default false
);

-- Partial, as with `format_versions`: one current season, any number of past ones.
create unique index seasons_one_current on seasons (is_current) where is_current;

alter table seasons enable row level security;

create policy seasons_public_read on seasons for select using (true);
