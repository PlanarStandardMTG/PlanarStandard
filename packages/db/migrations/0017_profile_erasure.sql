-- E16.10 — a profile outlives the account it was made from.
--
-- Erasure has to remove a person from the site without taking the record of
-- what happened with them. Eight tables reference `profiles`, and two of those
-- columns are `not null` — `posts.author_id` and `match_corrections.corrected_by`
-- — so deleting the row is not something the schema will even allow. Nor should
-- it: an article the community still reads, and the audit trail behind a rating
-- correction, are not the leaving member's to take with them.
--
-- So the profile becomes a tombstone. The personal data is cleared, the link to
-- the account is severed, the account itself is deleted outright, and every
-- foreign key still resolves. What is left carries nothing that identifies
-- anybody, which is what the regulation asks for — it asks for erasure of
-- personal data, not for the deletion of rows.

-- `id` stops being the auth user's id and becomes the profile's own identity.
-- The live link moves to `user_id`, which goes null when the account goes.
alter table profiles
  add column user_id uuid unique references auth.users (id) on delete set null,
  add column deleted_at timestamptz;

update profiles set user_id = id;

-- The cascade that used to take the profile with the account. Dropping it is
-- the whole point: the account is deleted, the tombstone stays.
alter table profiles drop constraint profiles_id_fkey;

comment on column profiles.user_id is
  'The auth account, while there is one. Null means the person deleted it and this row is a tombstone.';
comment on column profiles.deleted_at is
  'When the person asked to be erased. Set together with clearing every identifying column.';

-- Identity is `user_id` now, not `id`. A tombstone has no `user_id`, so no
-- policy below can ever match one — nobody inherits a deleted person's row.
drop policy profiles_self_update on profiles;

create policy profiles_self_update on profiles
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and role = (select role from profiles where user_id = auth.uid())
  );

-- The bootstrap trigger, now filling both columns. New rows keep `id` equal to
-- the auth id: nothing depends on that, and it makes a profile easy to find by
-- hand in a database where half the tables reference it.
create or replace function public.bootstrap_profile() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, user_id, display_name, avatar_url)
  values (
    new.id,
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'user_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Planeswalker'
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

/*
 * Scrub the profile whenever the account behind it goes, by whatever route.
 *
 * A trigger rather than a step in the erase function, because the dashboard is
 * also a route. An admin deleting a row from Supabase Studio would otherwise
 * sever the link and leave the name, handle and bio sitting there — personal
 * data surviving the deletion that was supposed to remove it, with nothing to
 * point at it any more.
 *
 * `before delete` and not `after`: `profiles.user_id` is `on delete set null`,
 * so by the time an after-trigger ran the link would already be gone and there
 * would be no way to find which profile this account belonged to.
 */
create function public.scrub_profile_for_deleted_account() returns trigger
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

  -- Both are `on delete set null` against `profiles`, and the profile is not
  -- being deleted — so they are unbound here instead. A tournament handle stays
  -- in the ledger either way: it is published result data from somebody else's
  -- platform, and ADR 003 records handles rather than people precisely so the
  -- two can be separated.
  update public.players set profile_id = null where profile_id = v_profile_id;
  update public.decks set owner_id = null where owner_id = v_profile_id;

  return old;
end;
$$;

create trigger on_auth_user_deleted
  before delete on auth.users
  for each row execute function public.scrub_profile_for_deleted_account();

/*
 * Erase one person.
 *
 * Deleting the `auth.users` row takes the email, the password hash, every linked
 * provider identity, and every session with it, by the cascades Supabase's own
 * schema declares — and fires the trigger above, which clears the profile. One
 * statement, one transaction, so the half-done state that must not be reachable
 * is not reachable: there is no window where the account is gone and the name is
 * still up, or the other way round.
 *
 * The visitor's access token stays valid until it expires, but `getUser`
 * revalidates against the auth server on every request, so the next one is
 * already signed out.
 */
create function public.erase_profile(p_user_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where user_id = p_user_id) then
    raise exception 'no profile for user %', p_user_id using errcode = 'no_data_found';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

-- `erase_profile` takes whoever it is given and is therefore **never** reachable
-- by a caller who could choose the argument. Left as-is it would be: Supabase
-- ships `alter default privileges ... grant execute on functions to anon,
-- authenticated`, so every new function in `public` starts out callable by any
-- visitor. `revoke ... from public` does **not** remove those — they are
-- explicit grants to named roles, not the implicit PUBLIC one — so both roles
-- have to be named here. What is left is the owner and service-role.
revoke all on function public.erase_profile(uuid) from public, anon, authenticated;

/*
 * The one a person can call for themselves.
 *
 * Takes no argument on purpose: there is nothing to point at somebody else. The
 * subject is `auth.uid()`, read from the caller's own token, so "only yourself"
 * is enforced by the database rather than by the route handler that happens to
 * call it today.
 *
 * `security definer` so it can reach the inner function, which nobody else may
 * execute. `auth.uid()` still reads the *caller's* claims inside a definer
 * function — those live in a session setting, which is not what `definer`
 * changes.
 */
create function public.erase_own_profile() returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  perform public.erase_profile(auth.uid());
end;
$$;

revoke all on function public.erase_own_profile() from public, anon;
grant execute on function public.erase_own_profile() to authenticated;
