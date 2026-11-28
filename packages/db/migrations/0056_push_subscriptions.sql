-- E26.28 — where to send a member's notifications when the play app is closed (§28).
--
-- One row per browser or installed app a member allowed notifications on. The endpoint
-- and keys are what the push service needs to deliver to that device; they are the
-- member's own and nobody else reads them. The server sends as service-role.

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_profile_idx on push_subscriptions (profile_id);

alter table push_subscriptions enable row level security;

create policy push_subscriptions_own_read on push_subscriptions
  for select to authenticated using (profile_id = public.current_profile_id());

create policy push_subscriptions_own_insert on push_subscriptions
  for insert to authenticated
  with check (profile_id = public.current_profile_id() and public.has_role('reader'));

create policy push_subscriptions_own_delete on push_subscriptions
  for delete to authenticated using (profile_id = public.current_profile_id());

/*
 * Erasing an account removes its devices with everything else: the profile is kept
 * as a tombstone (0017), so the cascade alone would not.
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
  delete from public.push_subscriptions where profile_id = v_profile_id;

  return old;
end;
$$;
