-- E26.17 — an entrant's deck, locked when the run starts (§28, ADR 013).
--
-- The list is copied here as text when the entrant picks or pastes it, so editing or
-- deleting the saved deck afterwards changes nothing in the run. `deck_id` remembers
-- which saved deck it came from, while there is one. Private while the run is played:
-- the entrant, the run's organizer and admins read it; everyone sees it once the
-- finished run is imported as an event.

-- A member's site handle, written when they register for a run.
alter type identity_source add value if not exists 'member_registered';

create table run_entrant_decks (
  entrant_id uuid primary key references run_entrants (id) on delete cascade,
  deck_id uuid references decks (id) on delete set null,
  decklist_text text not null check (length(trim(decklist_text)) > 0 and length(decklist_text) <= 20000),
  -- Legal in at least one of the run's format versions when it was saved; null when unchecked.
  is_legal boolean,
  updated_at timestamptz not null default now()
);

create index run_entrant_decks_deck_idx on run_entrant_decks (deck_id) where deck_id is not null;

create trigger run_entrant_decks_set_updated_at before update on run_entrant_decks
  for each row execute function set_updated_at();

alter table run_entrant_decks enable row level security;

/*
 * Whether the caller may change this entrant's deck now: their own entry while
 * registration is open, or the run's organizer before it starts. After that it is
 * locked for everyone (ADR 013).
 */
create function public.may_set_run_deck(p_entrant_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.run_entrants e
    join public.tournament_runs r on r.id = e.run_id
    where e.id = p_entrant_id
      and (
        (e.profile_id = public.current_profile_id() and public.has_role('reader') and r.state = 'registration')
        or (public.manages_run(r.id) and r.state in ('draft', 'registration'))
      )
  );
$$;

revoke all on function public.may_set_run_deck(uuid) from public, anon;
grant execute on function public.may_set_run_deck(uuid) to authenticated, service_role;

create policy run_entrant_decks_read on run_entrant_decks
  for select to authenticated
  using (
    exists (
      select 1 from public.run_entrants e
      where e.id = entrant_id
        and (e.profile_id = public.current_profile_id() or public.manages_run(e.run_id))
    )
  );

create policy run_entrant_decks_insert on run_entrant_decks
  for insert to authenticated with check (public.may_set_run_deck(entrant_id));

create policy run_entrant_decks_update on run_entrant_decks
  for update to authenticated
  using (public.may_set_run_deck(entrant_id))
  with check (public.may_set_run_deck(entrant_id));

create policy run_entrant_decks_delete on run_entrant_decks
  for delete to authenticated using (public.may_set_run_deck(entrant_id));
