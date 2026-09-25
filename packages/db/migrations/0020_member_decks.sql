-- E20.28 — a member imports a deck from a text list.
--
-- The first write path into `decks` (E14.5 left it closed until there was a flow
-- to write the policy for). A member owns what they import: they can read it
-- whatever its visibility, and nobody else can make it theirs.
--
-- What a member may NOT set on their own deck is as much the point as what they
-- may. `player_id` says who played it, and linking a deck to a ledger identity
-- is curation, not self-service (ADR 009). `locked_at` means it was played at an
-- event (ADR 013). `is_legal` and `validation` are a verdict, and a verdict the
-- submitter wrote is not one — until a job writes them, the deck page checks
-- legality live.

create policy decks_owner_read on decks for select to authenticated
  using (owner_id = public.current_profile_id());

create policy deck_cards_owner_read on deck_cards for select to authenticated
  using (exists (
    select 1 from decks
    where decks.id = deck_cards.deck_id
      and decks.owner_id = public.current_profile_id()
  ));

create policy decks_member_insert on decks for insert to authenticated
  with check (
    owner_id = public.current_profile_id()
    and public.has_role('reader')
    and submitted_via = 'import'
    and player_id is null
    and archetype_id is null
    and locked_at is null
    and parent_deck_id is null
    and is_legal is null
    and validation is null
  );

create policy deck_cards_owner_insert on deck_cards for insert to authenticated
  with check (
    public.has_role('reader')
    and exists (
      select 1 from decks
      where decks.id = deck_cards.deck_id
        and decks.owner_id = public.current_profile_id()
        and decks.locked_at is null
    )
  );

-- Cards go with the deck (`on delete cascade`); a locked deck is a record of an
-- event and stays.
create policy decks_owner_delete on decks for delete to authenticated
  using (
    owner_id = public.current_profile_id()
    and public.has_role('reader')
    and locked_at is null
  );

/*
 * A deck and its list in one transaction.
 *
 * `insertDeck` writes the two tables in two requests and compensates by
 * deleting (E13.16) — acceptable from a job, not from a form somebody submits
 * twice. Security invoker, so every policy above still applies: this adds
 * atomicity and nothing else.
 *
 * `cards` is a JSON array of `{ oracle_id, card_name, quantity, board,
 * set_code, collector_number }`.
 */
create function public.create_deck(
  deck_name text,
  deck_visibility public.deck_visibility,
  raw_import text,
  format_version_id uuid,
  cards jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.decks (name, owner_id, visibility, raw_import, format_version_id, submitted_via)
  values (deck_name, public.current_profile_id(), deck_visibility, raw_import, format_version_id, 'import')
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

revoke all on function public.create_deck(text, public.deck_visibility, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_deck(text, public.deck_visibility, text, uuid, jsonb)
  to authenticated, service_role;
