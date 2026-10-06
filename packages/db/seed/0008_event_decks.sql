-- Seed: decks played at events.
--
-- The deck browser's Tournament tab and its event filter (E20.55, E20.61) list
-- nothing without these. Every list is 60 cards legal in the current version,
-- so all of them show on the browser's default view. The players are invented,
-- like the seed's authors.
--
-- Orzhov Lifegain is a member's own import taken to an event: pellwater's
-- player played it, so it is listed on both the Community and Tournament tabs.
--
-- Weekly #40 and the Community Showcase are left without entries: the
-- tournaments repo tests use them as events with no standings.

insert into players (id, display_name, slug, profile_id) values
  ('55555555-5555-4555-8555-000000000001', 'Mossgrove', 'mossgrove', null),
  ('55555555-5555-4555-8555-000000000002', 'Emberlark', 'emberlark', null),
  ('55555555-5555-4555-8555-000000000003', 'Tidewhisper', 'tidewhisper', null),
  ('55555555-5555-4555-8555-000000000004', 'Cinderhollow', 'cinderhollow', null),
  ('55555555-5555-4555-8555-000000000005', 'Pellwater', 'pellwater', '11111111-1111-4111-8111-000000000006');

insert into decks
  (id, name, player_id, owner_id, season_id, format, format_version_id, visibility, submitted_via) values
  ('66666666-6666-4666-8666-000000000001', 'Mono-Green Stompy', '55555555-5555-4555-8555-000000000001', null,
   '44444444-4444-4444-8444-000000000001', 'planar_standard', '22222222-2222-4222-8222-000000000001', 'public', 'registration'),
  ('66666666-6666-4666-8666-000000000002', 'Boros Aggro', '55555555-5555-4555-8555-000000000002', null,
   '44444444-4444-4444-8444-000000000001', 'planar_standard', '22222222-2222-4222-8222-000000000001', 'public', 'registration'),
  ('66666666-6666-4666-8666-000000000003', 'Dimir Control', '55555555-5555-4555-8555-000000000003', null,
   '44444444-4444-4444-8444-000000000001', 'planar_standard', '22222222-2222-4222-8222-000000000001', 'public', 'registration'),
  ('66666666-6666-4666-8666-000000000004', 'Mono-Red Goblins', '55555555-5555-4555-8555-000000000004', null,
   '44444444-4444-4444-8444-000000000002', 'planar_standard', '22222222-2222-4222-8222-000000000001', 'public', 'registration'),
  ('66666666-6666-4666-8666-000000000005', 'Orzhov Lifegain', null, '11111111-1111-4111-8111-000000000006',
   '44444444-4444-4444-8444-000000000002', 'planar_standard', '22222222-2222-4222-8222-000000000001', 'public', 'import');

insert into deck_cards (deck_id, oracle_id, card_name, quantity, board) values
  ('66666666-6666-4666-8666-000000000001', '68954295-54e3-4303-a6bc-fc4547a4e3a3', 'Llanowar Elves', 4, 'main'),
  ('66666666-6666-4666-8666-000000000001', '6e2c2423-d854-4478-99e6-64f29851f026', 'Elvish Archdruid', 4, 'main'),
  ('66666666-6666-4666-8666-000000000001', '1ae339fd-8e64-4e3a-8e27-e4993932ba62', 'Gnarlback Rhino', 4, 'main'),
  ('66666666-6666-4666-8666-000000000001', '84122d81-9634-4d3f-85a5-f6cf4303691a', 'Mossborn Hydra', 4, 'main'),
  ('66666666-6666-4666-8666-000000000001', 'e56629ba-82d4-470f-9a6b-40c29d835af2', 'Quakestrider Ceratops', 4, 'main'),
  ('66666666-6666-4666-8666-000000000001', '3127ae9b-a7a7-43ec-89d7-688f8445b33d', 'Garruk''s Uprising', 4, 'main'),
  ('66666666-6666-4666-8666-000000000001', 'adac526d-1a85-431a-a302-0a4b8f4a0c44', 'Elvish Regrower', 4, 'main'),
  ('66666666-6666-4666-8666-000000000001', '645ab3c7-ee1d-4dd0-811f-2dc7f7c7e792', 'Grow from the Ashes', 4, 'main'),
  ('66666666-6666-4666-8666-000000000001', 'b34bb2dc-c1af-4d77-b0b3-a0fb342a5fc6', 'Forest', 28, 'main'),
  ('66666666-6666-4666-8666-000000000002', '60ba93eb-39e6-4af2-9c66-cd38f72daff2', 'Savannah Lions', 4, 'main'),
  ('66666666-6666-4666-8666-000000000002', 'd36e11f1-6ab3-4273-8114-a8fbbe21c1c3', 'Fanatical Firebrand', 4, 'main'),
  ('66666666-6666-4666-8666-000000000002', 'd812fc6d-b96d-4986-b171-9f3feee603dc', 'Hinterland Sanctifier', 4, 'main'),
  ('66666666-6666-4666-8666-000000000002', '95e94dea-5ac0-4d6f-adec-ca147aee861f', 'Ajani''s Pridemate', 4, 'main'),
  ('66666666-6666-4666-8666-000000000002', 'c107e271-5741-4a84-bfc4-3bc322972d0d', 'Courageous Goblin', 4, 'main'),
  ('66666666-6666-4666-8666-000000000002', 'ac2086fe-98ee-4280-9c7c-c5c2d6548a8b', 'Burst Lightning', 4, 'main'),
  ('66666666-6666-4666-8666-000000000002', 'f34b9bc4-7bfe-47fd-ba23-4eeeb46026eb', 'Lightning Strike', 4, 'main'),
  ('66666666-6666-4666-8666-000000000002', '2e9289d6-dbc6-456d-88cf-d1f534e731d6', 'Firebrand Archer', 4, 'main'),
  ('66666666-6666-4666-8666-000000000002', '2bee2508-cd5d-4c62-a205-12d8bbb3143d', 'Felidar Savior', 2, 'main'),
  ('66666666-6666-4666-8666-000000000002', 'b0af0c54-2a59-4075-8543-d41ff20c4c87', 'Wind-Scarred Crag', 4, 'main'),
  ('66666666-6666-4666-8666-000000000002', 'a3fb7228-e76b-4e96-a40e-20b5fed75685', 'Mountain', 11, 'main'),
  ('66666666-6666-4666-8666-000000000002', 'bc71ebf6-2056-41f7-be35-b2e5c34afa99', 'Plains', 11, 'main'),
  ('66666666-6666-4666-8666-000000000003', '713332c1-5bd8-400f-bfff-c1ca0697a043', 'Opt', 4, 'main'),
  ('66666666-6666-4666-8666-000000000003', 'fa85c5a2-8e83-4624-a35a-a0bbf17ecbb4', 'Think Twice', 4, 'main'),
  ('66666666-6666-4666-8666-000000000003', '46665089-aa3d-44c3-964d-6638dfbb5782', 'Essence Scatter', 4, 'main'),
  ('66666666-6666-4666-8666-000000000003', '33d405ea-7a9a-4970-b70f-9c05d90dd6f0', 'Duress', 4, 'main'),
  ('66666666-6666-4666-8666-000000000003', 'feb244f8-bcb1-44cf-9940-2719221a7309', 'Vampire Nighthawk', 4, 'main'),
  ('66666666-6666-4666-8666-000000000003', 'b9d0f2e1-62c2-44fd-ad38-471daf17bb0a', 'Tolarian Terror', 4, 'main'),
  ('66666666-6666-4666-8666-000000000003', '1b9ec782-0ba1-41f1-bc39-d3302494ecb3', 'Bake into a Pie', 4, 'main'),
  ('66666666-6666-4666-8666-000000000003', 'a15547d0-bbcb-41ee-a9ae-8325a9e7fe1f', 'Sire of Seven Deaths', 2, 'main'),
  ('66666666-6666-4666-8666-000000000003', '5d748bce-dff8-46fa-a3d1-633863b7bbff', 'Kiora, the Rising Tide', 2, 'main'),
  ('66666666-6666-4666-8666-000000000003', '52d14717-0cbc-4d7e-b546-54ea91580338', 'Dimir Guildgate', 4, 'main'),
  ('66666666-6666-4666-8666-000000000003', '865a2194-fca0-446e-aae3-ca475cd66e00', 'Dismal Backwater', 4, 'main'),
  ('66666666-6666-4666-8666-000000000003', 'b2c6aa39-2d2a-459c-a555-fb48ba993373', 'Island', 10, 'main'),
  ('66666666-6666-4666-8666-000000000003', '56719f6a-1a6c-4c0a-8d21-18f7d7350b68', 'Swamp', 10, 'main'),
  ('66666666-6666-4666-8666-000000000004', '86ec0b56-497f-481c-a03a-c4e64e8e7404', 'Searslicer Goblin', 4, 'main'),
  ('66666666-6666-4666-8666-000000000004', 'c107e271-5741-4a84-bfc4-3bc322972d0d', 'Courageous Goblin', 4, 'main'),
  ('66666666-6666-4666-8666-000000000004', 'd36e11f1-6ab3-4273-8114-a8fbbe21c1c3', 'Fanatical Firebrand', 4, 'main'),
  ('66666666-6666-4666-8666-000000000004', '5e78e6e0-60f0-4c3c-b8dd-bd673f5152b8', 'Viashino Pyromancer', 4, 'main'),
  ('66666666-6666-4666-8666-000000000004', '679841ad-f3ac-48e2-ba11-2cf6d78642b4', 'Raging Redcap', 4, 'main'),
  ('66666666-6666-4666-8666-000000000004', '79cd09e8-d738-47c0-9473-b6281bec6935', 'Goblin Surprise', 4, 'main'),
  ('66666666-6666-4666-8666-000000000004', 'ac2086fe-98ee-4280-9c7c-c5c2d6548a8b', 'Burst Lightning', 4, 'main'),
  ('66666666-6666-4666-8666-000000000004', 'f34b9bc4-7bfe-47fd-ba23-4eeeb46026eb', 'Lightning Strike', 4, 'main'),
  ('66666666-6666-4666-8666-000000000004', 'd44f3724-17b7-48f0-885d-75292669f971', 'Fiery Annihilation', 4, 'main'),
  ('66666666-6666-4666-8666-000000000004', 'a3fb7228-e76b-4e96-a40e-20b5fed75685', 'Mountain', 24, 'main'),
  ('66666666-6666-4666-8666-000000000005', '95e94dea-5ac0-4d6f-adec-ca147aee861f', 'Ajani''s Pridemate', 4, 'main'),
  ('66666666-6666-4666-8666-000000000005', 'd812fc6d-b96d-4986-b171-9f3feee603dc', 'Hinterland Sanctifier', 4, 'main'),
  ('66666666-6666-4666-8666-000000000005', 'feb244f8-bcb1-44cf-9940-2719221a7309', 'Vampire Nighthawk', 4, 'main'),
  ('66666666-6666-4666-8666-000000000005', 'b81a748b-f7a6-4ec4-8b18-40a1819745f6', 'Sanguine Syphoner', 4, 'main'),
  ('66666666-6666-4666-8666-000000000005', '60ba93eb-39e6-4af2-9c66-cd38f72daff2', 'Savannah Lions', 4, 'main'),
  ('66666666-6666-4666-8666-000000000005', '4c22257e-8a00-40b7-a29b-55fcec7ddbd4', 'Crypt Feaster', 4, 'main'),
  ('66666666-6666-4666-8666-000000000005', '2bee2508-cd5d-4c62-a205-12d8bbb3143d', 'Felidar Savior', 4, 'main'),
  ('66666666-6666-4666-8666-000000000005', '8164b1e8-3350-465e-8a17-75f57d326344', 'Exsanguinate', 4, 'main'),
  ('66666666-6666-4666-8666-000000000005', 'd37f858e-03c8-4594-9b92-cd03699a1591', 'Scoured Barrens', 4, 'main'),
  ('66666666-6666-4666-8666-000000000005', 'bc71ebf6-2056-41f7-be35-b2e5c34afa99', 'Plains', 12, 'main'),
  ('66666666-6666-4666-8666-000000000005', '56719f6a-1a6c-4c0a-8d21-18f7d7350b68', 'Swamp', 12, 'main');

insert into tournament_entries (tournament_id, player_id, deck_id, placement, match_wins, match_losses)
select tournaments.id, entry.player_id, entry.deck_id, entry.placement, entry.wins, entry.losses
from (values
  ('season-i-opener', '55555555-5555-4555-8555-000000000001'::uuid, '66666666-6666-4666-8666-000000000001'::uuid, 1, 4, 1),
  ('planar-standard-weekly-12', '55555555-5555-4555-8555-000000000001'::uuid, '66666666-6666-4666-8666-000000000001'::uuid, 9, 2, 2),
  ('season-i-opener', '55555555-5555-4555-8555-000000000002'::uuid, '66666666-6666-4666-8666-000000000002'::uuid, 4, 3, 2),
  ('lorwyn-eclipsed-finale', '55555555-5555-4555-8555-000000000002'::uuid, '66666666-6666-4666-8666-000000000002'::uuid, 2, 5, 1),
  ('lorwyn-eclipsed-finale', '55555555-5555-4555-8555-000000000003'::uuid, '66666666-6666-4666-8666-000000000003'::uuid, 1, 6, 0),
  ('planar-standard-weekly-38', '55555555-5555-4555-8555-000000000004'::uuid, '66666666-6666-4666-8666-000000000004'::uuid, 2, 3, 1),
  ('planar-standard-weekly-38', '55555555-5555-4555-8555-000000000005'::uuid, '66666666-6666-4666-8666-000000000005'::uuid, 1, 4, 0)
) as entry (slug, player_id, deck_id, placement, wins, losses)
join tournaments on tournaments.slug = entry.slug;
