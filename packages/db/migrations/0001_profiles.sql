-- E13.1 — profiles and the role enum.
--
-- §16 of the master plan. `profiles.id` is the auth user's id: one row per
-- signed-in person, created on first login (E16.4).

create type user_role as enum ('reader', 'writer', 'organizer', 'admin');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  handle text unique,
  avatar_url text,
  bio text,
  role user_role not null default 'reader',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Bylines are public: a post is worthless without an author to attribute it to.
-- `role` rides along, which is fine — who the organizers are is not a secret.
create policy profiles_public_read on profiles for select using (true);

-- A person may edit their own profile but never their own role; role grants are
-- admin-only and land with E14.4.
create policy profiles_self_update on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id and role = (select role from profiles where id = auth.uid()));
