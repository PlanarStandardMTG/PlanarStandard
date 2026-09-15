-- Seed: the format.
--
-- The pool here is the real one, taken from `content/pages/rules.mdx`, which is
-- the reviewed source for what is legal. Seeding an invented rotation would put
-- the database and that page in disagreement, and the page is the one people read.
--
-- No rows in `format_card_rules`: the current banlist is announced in Discord and
-- is not in this repository. An empty banlist is a state `/rules` has to render
-- correctly anyway, so it is the useful thing to seed.

insert into format_versions (id, name, effective_from, effective_to, is_current, notes_markdown) values
  (
    '22222222-2222-4222-8222-000000000001',
    'Planar Standard',
    '2026-01-21', null, true,
    'Six sets: Foundations as the permanent core, five rotating. Rotation follows the first Universes Within set of each year.'
  ),
  -- A special event declaring its own pool, which the rules page allows and
  -- which is the whole reason the pool is a table rather than a constant.
  (
    '22222222-2222-4222-8222-000000000002',
    'Foundations Gauntlet',
    '2026-06-13', '2026-06-14', false,
    'A one-weekend throwback: Foundations only, singleton, 100-card decks.'
  );

insert into format_legal_sets (format_version_id, set_code) values
  ('22222222-2222-4222-8222-000000000001', 'FDN'),
  ('22222222-2222-4222-8222-000000000001', 'DFT'),
  ('22222222-2222-4222-8222-000000000001', 'TDM'),
  ('22222222-2222-4222-8222-000000000001', 'EOE'),
  ('22222222-2222-4222-8222-000000000001', 'ECL'),
  ('22222222-2222-4222-8222-000000000001', 'SOS'),
  ('22222222-2222-4222-8222-000000000002', 'FDN');

insert into format_constraints
  (format_version_id, min_maindeck, max_maindeck, max_sideboard, max_copies, singleton) values
  ('22222222-2222-4222-8222-000000000001', 60, null, 15, 4, false),
  ('22222222-2222-4222-8222-000000000002', 100, 100, 0, 1, true);
