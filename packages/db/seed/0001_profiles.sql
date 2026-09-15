-- Seed: authors.
--
-- Every handle here is invented. The real community's handles appear in the
-- results data; putting words in their mouths in fake articles is a different
-- thing entirely, so the seed's writers are fictional.
--
-- `profiles.id` references `auth.users`, so the users have to exist first. These
-- are local-only rows with a throwaway password; nothing here reaches a
-- deployed environment.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
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
  '{}'::jsonb
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
  );
