-- E23.5 — the external event calendar cache and its sync ledger.
--
-- This is NOT `tournaments` (§13, E13.6), and the two must not be merged. A
-- `tournaments` row is the site's own record of an event that happened: it has a
-- season, a format version, entries, a ledger of matches, and an import that
-- created it. A row here is a poster — a cached line from somebody else's
-- calendar, rewritten wholesale every time the calendar is fetched. Pointing the
-- refresh at `tournaments` would let a third party's outage delete the ledger.
--
-- The link between them, when an event that was advertised here later gets its
-- results imported, belongs on `tournaments` as an external reference. It is not
-- needed yet and is not invented here.

create type external_event_state as enum ('scheduled', 'live', 'complete');

create table external_events (
  id uuid primary key default gen_random_uuid(),
  -- Text rather than an enum: a second calendar is a new parser and a new value,
  -- and an enum would make that a migration.
  source text not null default 'challonge',
  external_id text not null,
  name text not null,
  url text,
  state external_event_state not null,
  starts_at timestamptz,
  participant_count int not null default 0,
  structure text,
  -- When the payload this row came from was fetched. What "as of" means on the page.
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source, external_id)
);

-- Every read is "this source, in calendar order".
create index external_events_source_starts_idx on external_events (source, starts_at desc nulls last);

create trigger external_events_set_updated_at before update on external_events
  for each row execute function set_updated_at();

-- One row per source, forever. This is what answers "has anyone fetched
-- recently", and the refresh interval is measured against `last_attempted_at`,
-- never `last_succeeded_at`: measuring from success means an outage turns every
-- page view into another request against a 500-a-month budget.
create table external_event_syncs (
  source text primary key,
  last_attempted_at timestamptz,
  last_succeeded_at timestamptz,
  last_error text,
  event_count int not null default 0,
  updated_at timestamptz not null default now()
);

create trigger external_event_syncs_set_updated_at before update on external_event_syncs
  for each row execute function set_updated_at();

-- The row must exist before anything can claim a window: the claim is a
-- conditional update, and an update matches nothing when there is no row.
insert into external_event_syncs (source) values ('challonge');

alter table external_events enable row level security;
alter table external_event_syncs enable row level security;

-- The calendar is the public point of the feature. Everything in it is already
-- published on Challonge.
create policy external_events_public_read on external_events for select using (true);

-- No policy on the sync ledger, deliberately. Nothing but the service-role
-- client has any business reading when the site last called a third-party API,
-- and RLS on with no policy is the way to say that.
