-- E13.2 — format versions, their legal pool, their card rulings, their constraints.
--
-- §14 of the master plan. This is where format authority lives: a B&R
-- announcement is an admin editing rows, never a pull request.

-- NOTE: there are no `cards` or `card_printings` tables.
-- Card data lives in the repo as a build artifact (§14.1) because the Scryfall
-- bulk file is far larger than the free Postgres tier. Columns named `oracle_id`
-- below are Scryfall oracle IDs with no foreign key — integrity is enforced by
-- `dataset-integrity.test.ts` (§22) instead of by the database.

create table format_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  effective_from date not null,
  effective_to date,
  notes_markdown text,
  is_current boolean not null default false
);

-- Partial, so exactly one version may be current and any number may be historic.
-- A plain unique index would allow only one non-current version in the table.
create unique index format_versions_one_current
  on format_versions (is_current) where is_current;

-- The legal pool per version. Not the same thing as `data/sets.json`, which is
-- the *fetch scope* of the committed card dataset and changes by PR; this is the
-- pool, so a special event can define its own without a deploy (§14.1).
create table format_legal_sets (
  format_version_id uuid references format_versions (id) on delete cascade,
  set_code text not null,
  primary key (format_version_id, set_code)
);

create type card_ruling as enum ('banned', 'restricted', 'legal_exception');

create table format_card_rules (
  format_version_id uuid references format_versions (id) on delete cascade,
  oracle_id uuid not null,                     -- no FK: see the note above
  ruling card_ruling not null,
  reason text,
  effective_from date,
  primary key (format_version_id, oracle_id)
);

-- One row per version. Defaults are ordinary constructed-Magic values; a format
-- that wants none of them overrides the columns rather than growing new ones,
-- and anything genuinely one-off goes in `extra_rules`.
create table format_constraints (
  format_version_id uuid primary key references format_versions (id) on delete cascade,
  min_maindeck int not null default 60,
  max_maindeck int,
  max_sideboard int not null default 15,
  max_copies int not null default 4,
  singleton boolean not null default false,
  extra_rules jsonb not null default '{}'
);

alter table format_versions enable row level security;
alter table format_legal_sets enable row level security;
alter table format_card_rules enable row level security;
alter table format_constraints enable row level security;

-- What is legal is the most public fact the site holds: `/rules` renders all
-- four of these tables, signed in or not. Admin writes land with E14.4.
create policy format_versions_public_read on format_versions for select using (true);
create policy format_legal_sets_public_read on format_legal_sets for select using (true);
create policy format_card_rules_public_read on format_card_rules for select using (true);
create policy format_constraints_public_read on format_constraints for select using (true);
