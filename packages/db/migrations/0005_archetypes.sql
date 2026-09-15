-- E13.3 — the archetype vocabulary.
--
-- §14 of the master plan. Archetype names are data, so the community can rename
-- "Dimir Midrange" to "Dimir Control" mid-season without a deploy, and every
-- decklist that ever carried the old label keeps pointing at the same row.

create type archetype_supertype as enum ('aggro', 'midrange', 'control', 'combo', 'other');

create table archetypes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  supertype archetype_supertype not null,
  color_identity text[],
  description_markdown text,
  -- A sub-archetype points at its parent: "Azorius Control" under "Control"
  -- tiers the metagame report without duplicating either row.
  parent_id uuid references archetypes (id),
  is_active boolean not null default true
);

-- Every other spelling the sources use. An adapter reports `archetypeRaw` as the
-- source printed it and never resolves it; this table is what resolves it later.
create table archetype_aliases (
  id uuid primary key default gen_random_uuid(),
  archetype_id uuid not null references archetypes (id) on delete cascade,
  alias text not null,
  -- Generated, not written: `4c Dragons`, `4C-Dragons` and `4c dragons` are one
  -- alias, and the uniqueness has to hold against what the sources actually send.
  normalized text generated always as (lower(regexp_replace(alias, '[^a-z0-9]', '', 'gi'))) stored,
  unique (normalized)
);

create index archetype_aliases_archetype_idx on archetype_aliases (archetype_id);
create index archetypes_parent_idx on archetypes (parent_id) where parent_id is not null;

alter table archetypes enable row level security;
alter table archetype_aliases enable row level security;

-- The metagame is the site's whole subject; the vocabulary it is described in is
-- public. Admin writes land with E14.4.
create policy archetypes_public_read on archetypes for select using (true);
create policy archetype_aliases_public_read on archetype_aliases for select using (true);
