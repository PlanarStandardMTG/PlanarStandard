-- E20.31 — a member removes versions of a deck from their decks, and the rows stay.
--
-- A deck a member removes is hidden, not deleted: `hidden_at` takes it out of
-- every listing, history and page, and the row, its cards and anything derived
-- from it remain. A hidden deck a tournament entry points at is still public
-- wherever that entry is, because an event's record does not depend on what
-- the player later tidied out of their own list.
--
-- The versions kept close ranks: each one's parent becomes the nearest kept
-- version before it, so the visible history stays one line. That, and setting
-- `hidden_at`, are updates, and `decks` has no update policy — an edit writes a
-- new row (E20.30) — so `hide_deck_versions` is a definer function that checks
-- ownership itself.

alter table decks add column hidden_at timestamptz;

-- The rows stay: a member can no longer delete a deck, only hide it.
drop function public.delete_deck(uuid);
drop policy decks_owner_delete on decks;

-- One visible successor per member deck. A hidden version keeps its parent,
-- so without the predicate hiding the newest version would block the next edit.
drop index decks_one_successor;
create unique index decks_one_successor on decks (parent_deck_id)
  where parent_deck_id is not null and submitted_via = 'import' and hidden_at is null;

-- "Is this deck in an event" is asked by the read policy below for every hidden
-- deck. Partial, because most entries carry no deck.
create index tournament_entries_deck_idx on tournament_entries (deck_id)
  where deck_id is not null;

/*
 * Whether any tournament entry names the deck. Definer so the read policy on
 * `decks` does not depend on `tournament_entries`' own policy, which reads
 * `tournaments`.
 */
create function public.deck_in_event(deck_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tournament_entries e where e.deck_id = deck_in_event.deck_id
  );
$$;

grant execute on function public.deck_in_event(uuid) to anon, authenticated, service_role;

-- The owner's own read (`decks_owner_read`) is unchanged, hidden decks
-- included: the data export reads through the member's client and has to hand
-- over everything they own (E16.11). The pages filter hidden decks out.
drop policy decks_public_read on decks;

create policy decks_public_read on decks
  for select using (
    visibility <> 'private'
    and (hidden_at is null or public.deck_in_event(id))
  );

/*
 * Hide `version_ids`, all of them visible versions of the deck `deck_id`
 * belongs to, and relink the versions kept. Returns the newest version left
 * visible, or null when none is.
 *
 * Every visible version must be the caller's own import, not only the ones
 * being hidden: relinking touches the ones kept. Hiding first takes those rows
 * out of `decks_one_successor`, which frees their parents for the relink.
 */
create function public.hide_deck_versions(deck_id uuid, version_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  versions uuid[];
  previous uuid := null;
  version uuid;
begin
  if not public.has_role('reader') then
    raise exception 'not allowed to remove decks' using errcode = '42501';
  end if;

  select array_agg(l.id order by l.created_at) into versions
  from public.deck_lineage(hide_deck_versions.deck_id) l
  where l.hidden_at is null;

  if versions is null or exists (
    select 1 from public.decks d
    where d.id = any (versions)
      and (
        d.owner_id is distinct from public.current_profile_id()
        or d.submitted_via is distinct from 'import'
      )
  ) then
    raise exception 'not your deck to remove' using errcode = '42501';
  end if;

  if cardinality(version_ids) = 0 or not version_ids <@ versions then
    raise exception 'not visible versions of this deck' using errcode = '22023';
  end if;

  update public.decks set hidden_at = now() where id = any (version_ids);

  foreach version in array versions loop
    continue when version = any (version_ids);
    update public.decks set parent_deck_id = previous
    where id = version and parent_deck_id is distinct from previous;
    previous := version;
  end loop;

  return previous;
end;
$$;

revoke all on function public.hide_deck_versions(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.hide_deck_versions(uuid, uuid[]) to authenticated;
