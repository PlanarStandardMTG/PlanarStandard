-- E13.7 — decks and deck_cards.
--
-- §14 of the master plan. A deck is a decklist somebody registered: seventy-five
-- lines, an owner, and whatever the source knew about it.
--
-- NOTE: there are no `cards` or `card_printings` tables. Card data lives in the
-- repo as a build artifact (§14.1) because the Scryfall bulk file is far larger
-- than the free Postgres tier, so `deck_cards.oracle_id` is a Scryfall oracle id
-- with **no foreign key** — integrity is enforced by `dataset-integrity.test.ts`
-- (§22) instead of by the database.

create type deck_visibility as enum ('private', 'unlisted', 'public');

create table decks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Who administers it, and who played it. Usually different people: most decks
  -- arrive from an import and have a player but no account behind them (ADR 009).
  owner_id uuid references profiles (id) on delete set null,
  player_id uuid references players (id),
  season_id uuid references seasons (id),
  format_version_id uuid references format_versions (id),
  -- The resolved archetype, and the label the source actually printed. Both, and
  -- never one: an adapter reports `archetype_raw` verbatim and never resolves it
  -- (E12.7), so keeping the raw string is what lets a re-run of resolution fix a
  -- mislabelled deck without going back to the source file.
  archetype_id uuid references archetypes (id),
  archetype_raw text,
  visibility deck_visibility not null default 'public',
  description_markdown text,
  source_url text,
  -- The decklist exactly as it arrived, before parsing. A parser fix re-runs
  -- from here rather than from a file nobody kept (§26).
  raw_import text,
  submitted_via text check (
    submitted_via in ('registration', 'organizer', 'backfill', 'import')
  ),
  -- Set when the event starts (ADR 013). A locked deck is the one that was
  -- played; edits after this point fork rather than overwrite.
  locked_at timestamptz,
  parent_deck_id uuid references decks (id),
  -- Null until legality has been checked. False and a `validation` payload is a
  -- deck that failed it — kept, flagged, and excluded from card stats (E18.10),
  -- because deleting somebody's list because we could not resolve a card is how
  -- the data stops being a record of what happened.
  is_legal boolean,
  validation jsonb,
  created_at timestamptz not null default now()
);

create table deck_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks (id) on delete cascade,
  -- Null when the name did not resolve. The row survives either way (E18.10).
  oracle_id uuid,
  -- The name as the decklist printed it. This is the authority, not the ids
  -- beside it: the parser resolves by name and never by printing (ADR 007).
  card_name text not null,
  quantity int not null check (quantity > 0),
  -- Text with a check rather than an enum, mirroring `Board` in contracts. A
  -- staged row can carry a board a future parser invents, and a failed check is
  -- a better error than a failed cast.
  board text not null default 'main' check (board in ('main', 'side', 'command')),
  -- Provenance, and nothing more. `(PLST) WOE-273` is kept exactly as written
  -- and never has to resolve to anything — legality, set attribution and rarity
  -- all come from the card's printing inside the legal pool (§14.1).
  set_code text,
  collector_number text
);

create index deck_cards_deck_idx on deck_cards (deck_id);
create index decks_season_idx on decks (season_id);
create index decks_player_idx on decks (player_id) where player_id is not null;

-- "Every deck playing this card" is the query behind card stats, the card detail
-- page, and the archetype map's `?highlight=`. Partial, because an unresolved
-- card is excluded from all three by definition.
create index deck_cards_oracle_idx on deck_cards (oracle_id) where oracle_id is not null;

alter table decks enable row level security;
alter table deck_cards enable row level security;

-- Unlisted is readable, not hidden: it means "not in the listings", and the
-- point of an unlisted deck is that its link works. Filtering a browse page down
-- to `public` is the query's job, which is why this policy does not do it —
-- expressing "only if you already knew the id" in RLS is not possible, and
-- pretending otherwise would make every share link 404.
create policy decks_public_read on decks
  for select using (visibility <> 'private');

create policy deck_cards_public_read on deck_cards
  for select using (exists (
    select 1 from decks
    where decks.id = deck_cards.deck_id
      and decks.visibility <> 'private'
  ));
