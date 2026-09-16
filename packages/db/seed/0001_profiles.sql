-- Seed: authors.
--
-- Every handle here is invented. The real community's handles appear in the
-- results data; putting words in their mouths in fake articles is a different
-- thing entirely, so the seed's writers are fictional.
--
-- `profiles.id` references `auth.users`, so the users have to exist first. These
-- are local-only rows with a throwaway password; nothing here reaches a
-- deployed environment.
--
-- Creating those users fires migration 0016's trigger, so each of these already
-- has a profile by the time the second statement runs. The upsert below is that
-- trigger working, not a collision to route around: it makes the default row
-- into a specific person, and it sets the one thing the trigger will not — the
-- role. Every writer and organizer the seeded site needs comes from here.

-- The token columns are set to '' and not left to default. GoTrue scans them
-- into Go strings and a NULL is a 500 on sign-in — "Database error querying
-- schema", which names neither the column nor the row. Nothing read these until
-- there was a login (E16.3), so the seeded accounts looked fine and none of them
-- could sign in.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000',
  id,
  'authenticated',
  'authenticated',
  email,
  crypt('seed-password-not-a-secret', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  '', '', '', '', '', '', '', ''
from (values
  ('11111111-1111-4111-8111-000000000001'::uuid, 'newsdesk@planarstandard.test'),
  ('11111111-1111-4111-8111-000000000002'::uuid, 'wrenfield@planarstandard.test'),
  ('11111111-1111-4111-8111-000000000003'::uuid, 'tallowmere@planarstandard.test'),
  ('11111111-1111-4111-8111-000000000004'::uuid, 'quillfeather@planarstandard.test'),
  ('11111111-1111-4111-8111-000000000005'::uuid, 'brackwater@planarstandard.test')
) as u(id, email);

insert into profiles (id, display_name, handle, avatar_url, bio, role) values
  (
    '11111111-1111-4111-8111-000000000001',
    'Planar Standard',
    'planarstandard',
    null,
    'Format announcements, event news, and B&R updates.',
    'admin'
  ),
  (
    '11111111-1111-4111-8111-000000000002',
    'Wren Ashfield',
    'wrenfield',
    null,
    'Control player. Writes about the decks everyone else is trying to beat.',
    'writer'
  ),
  (
    '11111111-1111-4111-8111-000000000003',
    'Tam Tallowmere',
    'tallowmere',
    null,
    'Runs the Thursday series. Mostly here to argue about sideboards.',
    'organizer'
  ),
  (
    '11111111-1111-4111-8111-000000000004',
    'Ines Quillfeather',
    'quillfeather',
    null,
    'Budget brewer. Has never sleeved a rare on purpose.',
    'writer'
  ),
  (
    '11111111-1111-4111-8111-000000000005',
    'Odis Brackwater',
    'brackwater',
    null,
    'Aggro apologist.',
    'writer'
  )
on conflict (id) do update set
  display_name = excluded.display_name,
  handle       = excluded.handle,
  avatar_url   = excluded.avatar_url,
  bio          = excluded.bio,
  role         = excluded.role;
