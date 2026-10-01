-- E20.56 — match decklist lines the card data could not, once it can.
--
-- A line whose name did not resolve is kept with a null `oracle_id` (E18.10).
-- Names are resolved when a deck is saved, against the card data deployed at
-- the time, so a line naming a card from a set added to `data/sets.json` later
-- stays unmatched until something looks again. These two functions are that
-- look: the names, and then the ids the site's resolver found for them.

/* Every name still waiting for a card, once each. */
create function public.unmatched_card_names()
returns setof text
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct c.card_name from public.deck_cards c
  where c.oracle_id is null
  order by 1;
$$;

/*
 * Give every unmatched line with one of these names its card. Pairs by
 * position. Returns how many lines were matched.
 */
create function public.match_deck_cards(p_names text[], p_oracle_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  matched integer;
begin
  update public.deck_cards c set oracle_id = m.oracle_id
  from unnest(p_names, p_oracle_ids) as m (card_name, oracle_id)
  where c.card_name = m.card_name
    and c.oracle_id is null;
  get diagnostics matched = row_count;
  return matched;
end;
$$;

revoke all on function public.unmatched_card_names() from public, anon, authenticated;
grant execute on function public.unmatched_card_names() to service_role;
revoke all on function public.match_deck_cards(text[], uuid[]) from public, anon, authenticated;
grant execute on function public.match_deck_cards(text[], uuid[]) to service_role;
