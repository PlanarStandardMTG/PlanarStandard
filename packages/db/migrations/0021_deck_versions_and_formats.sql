-- E20.30 — a member edits their deck, and picks the format it is built for.
--
-- An edit never updates a row: it writes a new deck whose `parent_deck_id` is
-- the one it replaces, so every earlier list stays readable at its own URL and
-- the chain of parents is the deck's history. There is still no update policy
-- on `decks`, and that is the point.
--
-- `format` is which rules a deck is built for, not which version of them:
-- `format_version_id` still records the Planar Standard version in force when a
-- deck was saved. Kitchen Table is casual play with no rules to check, so it has
-- no version and no rows in `format_*` — there is nothing there for an admin to
-- edit.

alter table decks
  add column format text not null default 'planar_standard'
    check (format in ('planar_standard', 'kitchen_table'));

-- One successor per member deck, so a history is a line and not a tree: saving
-- an edit to a version that has already been edited fails rather than forking.
-- Scoped to imports because a deck locked at an event forks by design (ADR 013).
create unique index decks_one_successor on decks (parent_deck_id)
  where parent_deck_id is not null and submitted_via = 'import';

drop policy decks_member_insert on decks;

create policy decks_member_insert on decks for insert to authenticated
  with check (
    owner_id = public.current_profile_id()
    and public.has_role('reader')
    and submitted_via = 'import'
    and player_id is null
    and archetype_id is null
    and locked_at is null
    and is_legal is null
    and validation is null
    and (
      parent_deck_id is null
      or exists (
        select 1 from decks parent
        where parent.id = decks.parent_deck_id
          and parent.owner_id = public.current_profile_id()
          and parent.submitted_via = 'import'
      )
    )
  );

drop function public.create_deck(text, public.deck_visibility, text, uuid, jsonb);

/*
 * A deck and its list in one transaction — a new deck, or with `parent_deck_id`
 * the next version of one. Security invoker, so `decks_member_insert` still
 * decides whose deck may be edited.
 *
 * `cards` is a JSON array of `{ oracle_id, card_name, quantity, board,
 * set_code, collector_number }`.
 */
create function public.create_deck(
  deck_name text,
  deck_visibility public.deck_visibility,
  deck_format text,
  raw_import text,
  format_version_id uuid,
  parent_deck_id uuid,
  cards jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.decks (
    name, owner_id, visibility, format, raw_import, format_version_id, parent_deck_id, submitted_via
  )
  values (
    deck_name, public.current_profile_id(), deck_visibility, deck_format, raw_import,
    format_version_id, parent_deck_id, 'import'
  )
  returning id into new_id;

  insert into public.deck_cards (deck_id, oracle_id, card_name, quantity, board, set_code, collector_number)
  select new_id, c.oracle_id, c.card_name, c.quantity, c.board, c.set_code, c.collector_number
  from jsonb_to_recordset(cards) as c(
    oracle_id uuid,
    card_name text,
    quantity int,
    board text,
    set_code text,
    collector_number text
  );

  return new_id;
end;
$$;

revoke all on function public.create_deck(text, public.deck_visibility, text, text, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_deck(text, public.deck_visibility, text, text, uuid, uuid, jsonb)
  to authenticated, service_role;

/*
 * Every version of the deck `deck_id` belongs to, oldest first: its ancestors,
 * itself, and its successors. Invoker, so the read policies apply to every step
 * and a version the caller may not see is not returned.
 */
create function public.deck_lineage(deck_id uuid)
returns setof public.decks
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive
    ancestors as (
      select d.* from public.decks d where d.id = deck_lineage.deck_id
      union
      select p.* from public.decks p join ancestors a on p.id = a.parent_deck_id
    ),
    descendants as (
      select d.* from public.decks d where d.id = deck_lineage.deck_id
      union
      select c.* from public.decks c join descendants s on c.parent_deck_id = s.id
    )
  select * from ancestors
  union
  select * from descendants
  order by created_at;
$$;

grant execute on function public.deck_lineage(uuid) to anon, authenticated, service_role;

/*
 * Delete a deck with all its versions. Deleting only the newest would promote
 * the one before it back into the member's list; one statement, so the
 * self-reference is checked once the whole history is gone. `decks_owner_delete`
 * still decides, so this deletes only the caller's own unlocked decks.
 */
create function public.delete_deck(deck_id uuid)
returns integer
language sql
security invoker
set search_path = ''
as $$
  with deleted as (
    delete from public.decks
    where id in (select l.id from public.deck_lineage(delete_deck.deck_id) l)
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function public.delete_deck(uuid) from public, anon, authenticated;
grant execute on function public.delete_deck(uuid) to authenticated, service_role;
