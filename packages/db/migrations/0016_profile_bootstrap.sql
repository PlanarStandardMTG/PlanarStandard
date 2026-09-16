-- E16.4 — a profile row for every auth user, created on first login.
--
-- A trigger rather than an upsert in the OAuth callback. `profiles.id` is a
-- foreign key onto `auth.users`, and every table that attributes anything —
-- posts, imports, merges, corrections — points at `profiles`. A person who can
-- sign in but has no profile row is a foreign key violation waiting to happen,
-- so the row is created by the same statement that creates the user rather than
-- by whichever code path happens to run next.
--
-- It also means an account created outside our callback — an admin invite from
-- the Supabase dashboard, a provider added later — gets a profile too.

create function public.bootstrap_profile() returns trigger
language plpgsql
security definer
-- Forces every identifier below to be schema-qualified. Without it a `public`
-- on someone else's search_path decides what this function writes to.
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    -- Discord populates `full_name` and `name`; the others are for whatever
    -- provider comes second. The email local-part is a last resort, and the
    -- literal is for an account with no email at all, which is legal in auth.
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

-- `handle` is left null on purpose. It is unique, and a Discord username is not:
-- claiming one here would hand the first person to sign in a name the second
-- person cannot then use. Choosing it is the profile page's job.

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.bootstrap_profile();

-- Every account that already exists. The trigger only fires from here on, and a
-- signed-in visitor with no profile row is an error the site cannot recover
-- from at render time — so the two cases are closed together, in one migration.
insert into public.profiles (id, display_name, avatar_url)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    nullif(u.raw_user_meta_data ->> 'user_name', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Planeswalker'
  ),
  nullif(u.raw_user_meta_data ->> 'avatar_url', '')
from auth.users u
on conflict (id) do nothing;
