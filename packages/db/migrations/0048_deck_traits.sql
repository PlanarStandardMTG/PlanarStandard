-- E20.72 — what the deck browser lists and filters by, stored once.
--
-- `/decks` used to load every public deck with every card on each request,
-- then check each one's colours, card names and legality against the card
-- data. Cards are not in Postgres, so the site still does that work, but when
-- a deck is saved rather than when it is browsed, and writes the answers here
-- as service role. Like every derived table, nobody else writes them (ADR 008).

-- One row per deck.
create table deck_traits (
  deck_id uuid primary key references decks (id) on delete cascade,
  -- The maindeck's colour identity, lands included: the pips a deck shows.
  colors text[] not null,
  -- Every colour a spell on any board has in its mana cost: the colour filter.
  cast_colors text[] not null,
  -- Each card's normalized name, once each: the card-name filter.
  card_names text[] not null,
  computed_at timestamptz not null default now()
);

-- One row per deck and format version: whether the deck is legal under that
-- version's rules as they were when it was computed.
create table deck_legality (
  format_version_id uuid not null references format_versions (id) on delete cascade,
  deck_id uuid not null references decks (id) on delete cascade,
  legal boolean not null,
  computed_at timestamptz not null default now(),
  primary key (format_version_id, deck_id)
);

-- Set when something can have made a legal deck illegal under this version:
-- its rules narrowed, or decklist lines were matched to cards. Its
-- `deck_legality` rows are out of date until an admin rechecks the decks.
-- True to begin with, because nothing has been computed yet.
alter table format_versions
  add column deck_legality_stale boolean not null default true;

alter table deck_traits enable row level security;
alter table deck_legality enable row level security;

-- Readable wherever the deck is: `decks`' own policies decide inside the
-- subquery, so a private deck's colours are as private as its list.
create policy deck_traits_read on deck_traits
  for select using (exists (select 1 from decks where decks.id = deck_traits.deck_id));

create policy deck_legality_read on deck_legality
  for select using (exists (select 1 from decks where decks.id = deck_legality.deck_id));
