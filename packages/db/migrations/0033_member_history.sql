-- E20.42 — an admin sees and removes what one member made.
--
-- The member history page lists a member's posts and saved decks. An admin
-- needs all of them, drafts and private decks included, and needs to delete
-- them: nothing before this let anyone but the author do either.
--
-- Deletes go through functions rather than delete policies, because a saved deck
-- is a line of versions and a version an event names is a record of that event
-- (ADR 013). A deck is removed whole: deleted when no event names any version,
-- hidden otherwise, which takes it off the member's decks and the browser while
-- the event keeps its list.

create policy posts_admin_read on posts for select to authenticated
  using (public.has_role('admin'));

create policy decks_admin_read on decks for select to authenticated
  using (public.has_role('admin'));

create policy deck_cards_admin_read on deck_cards for select to authenticated
  using (public.has_role('admin'));

create function public.admin_delete_post(p_post_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin') then
    raise exception 'admins only' using errcode = 'insufficient_privilege';
  end if;

  delete from public.posts where id = p_post_id;
end;
$$;

/*
 * Remove one of a member's saved decks, every version of it. Returns 'deleted',
 * or 'hidden' when an event names a version.
 */
create function public.admin_remove_deck(p_deck_id uuid) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  if not public.has_role('admin') then
    raise exception 'admins only' using errcode = 'insufficient_privilege';
  end if;

  select array_agg(l.id) into v_ids
  from public.deck_lineage(p_deck_id) l
  where l.submitted_via = 'import';

  if v_ids is null then
    raise exception 'no saved deck %', p_deck_id using errcode = 'no_data_found';
  end if;

  if exists (select 1 from public.tournament_entries e where e.deck_id = any (v_ids)) then
    update public.decks set hidden_at = coalesce(hidden_at, now()) where id = any (v_ids);
    return 'hidden';
  end if;

  -- One statement, so the parent links between versions are checked once, at its end.
  delete from public.decks where id = any (v_ids);
  return 'deleted';
end;
$$;

/*
 * Everything a member made, at once: every post, and every saved deck removed
 * as `admin_remove_deck` would. Never the caller's own, as with a ban.
 */
create function public.admin_remove_member_content(p_profile_id uuid)
returns table (posts_deleted integer, decks_deleted integer, decks_hidden integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used uuid[];
begin
  if not public.has_role('admin') then
    raise exception 'admins only' using errcode = 'insufficient_privilege';
  end if;
  if p_profile_id = public.current_profile_id() then
    raise exception 'not your own' using errcode = 'insufficient_privilege';
  end if;

  delete from public.posts where author_id = p_profile_id;
  get diagnostics posts_deleted = row_count;

  -- A member's versions all share an owner, so an event naming any one of
  -- them keeps that deck's whole line.
  select coalesce(array_agg(distinct l.id), '{}') into v_used
  from public.decks d
  join public.tournament_entries e on e.deck_id = d.id
  cross join lateral public.deck_lineage(d.id) l
  where d.owner_id = p_profile_id and d.submitted_via = 'import';

  update public.decks set hidden_at = coalesce(hidden_at, now())
  where id = any (v_used);
  get diagnostics decks_hidden = row_count;

  delete from public.decks
  where owner_id = p_profile_id and submitted_via = 'import' and not (id = any (v_used));
  get diagnostics decks_deleted = row_count;

  return next;
end;
$$;

revoke all on function public.admin_delete_post(uuid) from public, anon;
revoke all on function public.admin_remove_deck(uuid) from public, anon;
revoke all on function public.admin_remove_member_content(uuid) from public, anon;
grant execute on function public.admin_delete_post(uuid) to authenticated;
grant execute on function public.admin_remove_deck(uuid) to authenticated;
grant execute on function public.admin_remove_member_content(uuid) to authenticated;
