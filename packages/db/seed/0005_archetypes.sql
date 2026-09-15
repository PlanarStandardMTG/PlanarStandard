-- Seed: the archetype vocabulary.
--
-- Five archetypes the repository already names — in `seed/0002_posts.sql` and in
-- `fixtures/archetype-map/` — so a metagame chart built against this seed shows
-- the same names the sample posts talk about.
--
-- Aliases include the map's own label form, `4c Dragons (Midrange)`, because that
-- is what `archetype-map-html` reports as `archetypeRaw` and what resolution has
-- to cope with (E12.7).

insert into archetypes (id, name, supertype, color_identity, description_markdown) values
  ('33333333-3333-4333-8333-000000000001', 'Azorius Control', 'control',  array['W','U'],
   'Counterspells, sweepers, and a small number of finishers. The format''s default answer deck.'),
  ('33333333-3333-4333-8333-000000000002', 'Golgari Midrange', 'midrange', array['B','G'],
   'Efficient creatures and removal, grinding on card advantage rather than on speed.'),
  ('33333333-3333-4333-8333-000000000003', 'Abzan Midrange', 'midrange', array['W','B','G'],
   'Golgari''s plan with a white splash for the best removal and the best sideboard cards.'),
  -- Tempo is not one of the five supertypes, so it lands in `other` rather than
  -- being filed under the one it is least unlike.
  ('33333333-3333-4333-8333-000000000004', 'Dimir Faeries', 'other', array['U','B'],
   'Flash threats and disruption, winning on tempo rather than on card quality.'),
  ('33333333-3333-4333-8333-000000000005', '4c Dragons', 'midrange', array['W','U','B','G'],
   'Tarkir''s dragons, held together by fixing. Powerful and unreliable in equal measure.');

insert into archetype_aliases (archetype_id, alias) values
  ('33333333-3333-4333-8333-000000000001', 'Azorius Control (Control)'),
  ('33333333-3333-4333-8333-000000000001', 'UW Control'),
  ('33333333-3333-4333-8333-000000000002', 'Golgari Midrange (Midrange)'),
  ('33333333-3333-4333-8333-000000000002', 'BG Midrange'),
  ('33333333-3333-4333-8333-000000000003', 'Abzan Midrange (Midrange)'),
  ('33333333-3333-4333-8333-000000000004', 'Dimir Faeries (Tempo)'),
  ('33333333-3333-4333-8333-000000000004', 'UB Faeries'),
  ('33333333-3333-4333-8333-000000000005', '4c Dragons (Midrange)'),
  ('33333333-3333-4333-8333-000000000005', 'Four-Colour Dragons');
