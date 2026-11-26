-- E26.15 — a member's Arena username and Discord name (§28).
--
-- Their own table, because anyone can read `profiles`. These are how two players
-- find each other for a Direct Challenge, or how an admin reaches somebody — not
-- handles, never shown on a public page, and readable only by:
--
--   the member
--   admins
--   the organizer of a run the member is entered in
--   the member's opponent, while they are paired

create table profile_contacts (
  profile_id uuid primary key references profiles (id) on delete cascade,
  arena_username text check (length(arena_username) between 1 and 64),
  discord_name text check (length(discord_name) between 1 and 64),
  updated_at timestamptz not null default now()
);

create trigger profile_contacts_set_updated_at before update on profile_contacts
  for each row execute function set_updated_at();

alter table profile_contacts enable row level security;

create policy profile_contacts_own_read on profile_contacts
  for select to authenticated
  using (profile_id = public.current_profile_id());

create policy profile_contacts_admin_read on profile_contacts
  for select to authenticated
  using (public.has_role('admin'));

create policy profile_contacts_organizer_read on profile_contacts
  for select to authenticated
  using (
    exists (
      select 1 from public.run_entrants e
      where e.profile_id = profile_contacts.profile_id and public.manages_run(e.run_id)
    )
  );

create policy profile_contacts_opponent_read on profile_contacts
  for select to authenticated
  using (
    exists (
      select 1 from public.run_entrants e
      where e.profile_id = profile_contacts.profile_id and public.is_current_opponent(e.id)
    )
  );

-- Written only by the member, while in good standing; removed by them at any time.
create policy profile_contacts_own_insert on profile_contacts
  for insert to authenticated
  with check (profile_id = public.current_profile_id() and public.has_role('reader'));

create policy profile_contacts_own_update on profile_contacts
  for update to authenticated
  using (profile_id = public.current_profile_id() and public.has_role('reader'))
  with check (profile_id = public.current_profile_id() and public.has_role('reader'));

create policy profile_contacts_own_delete on profile_contacts
  for delete to authenticated
  using (profile_id = public.current_profile_id());

/*
 * 0017's scrub, now also removing the contact names — personal data that would
 * otherwise outlive the account it belonged to.
 */
create or replace function public.scrub_profile_for_deleted_account() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  select id into v_profile_id from public.profiles where user_id = old.id;
  if v_profile_id is null then
    return old;
  end if;

  update public.profiles
  set display_name = 'Deleted member',
      handle       = null,
      avatar_url   = null,
      bio          = null,
      deleted_at   = now()
  where id = v_profile_id;

  update public.players set profile_id = null where profile_id = v_profile_id;
  update public.decks set owner_id = null where owner_id = v_profile_id;
  delete from public.profile_contacts where profile_id = v_profile_id;

  return old;
end;
$$;
