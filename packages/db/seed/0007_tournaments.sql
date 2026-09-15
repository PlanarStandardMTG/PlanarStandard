-- Seed: tournaments.
--
-- Eight events across the two finished seasons plus one still being set up, so
-- every `tournament_status` the site renders differently is present — including
-- the `draft` row, which exists to prove the public-read policy hides it.
--
-- `is_rated` is false on the two standings-only events: they are recorded for
-- metagame purposes and rate nothing, which is ADR 006 as a row rather than as a
-- paragraph.

insert into tournaments
  (name, slug, event_date, season_id, format_version_id, platform, external_url,
   structure, rounds, player_count, weight, is_rated, status) values

  -- Season I — fortnightly
  ('Season I Opener', 'season-i-opener', '2026-01-24',
   '44444444-4444-4444-8444-000000000001', '22222222-2222-4222-8222-000000000001',
   'Challonge', 'https://challonge.com/ps_season_i_opener', 'swiss', 5, 34, 1.0, true, 'verified'),
  ('Planar Standard Weekly #12', 'planar-standard-weekly-12', '2026-02-07',
   '44444444-4444-4444-8444-000000000001', '22222222-2222-4222-8222-000000000001',
   'Challonge', 'https://challonge.com/ps_weekly_12', 'swiss', 4, 22, 1.0, true, 'verified'),
  ('Lorwyn Eclipsed Finale', 'lorwyn-eclipsed-finale', '2026-04-18',
   '44444444-4444-4444-8444-000000000001', '22222222-2222-4222-8222-000000000001',
   'Challonge', 'https://challonge.com/ps_finale_i', 'swiss + top 8', 6, 48, 2.0, true, 'verified'),

  -- The special-event pool, on its own format version
  ('Foundations Gauntlet', 'foundations-gauntlet', '2026-06-13',
   '44444444-4444-4444-8444-000000000002', '22222222-2222-4222-8222-000000000002',
   'Spelltable', null, 'round robin', 5, 12, 0.5, true, 'verified'),

  -- Season II — weekly
  ('Planar Standard Weekly #38', 'planar-standard-weekly-38', '2026-08-08',
   '44444444-4444-4444-8444-000000000002', '22222222-2222-4222-8222-000000000001',
   'Challonge', 'https://challonge.com/ps_weekly_38', 'swiss', 4, 27, 1.0, true, 'results_imported'),
  ('Planar Standard Weekly #40', 'planar-standard-weekly-40', '2026-08-22',
   '44444444-4444-4444-8444-000000000002', '22222222-2222-4222-8222-000000000001',
   'Challonge', 'https://challonge.com/ps_weekly_40', 'swiss', 4, 31, 1.0, true, 'results_imported'),
  -- Standings only: the source reported placements and nothing else, so it is
  -- recorded and unrated. Never infer pairings from placements (ADR 006).
  ('Community Showcase', 'community-showcase', '2026-07-11',
   '44444444-4444-4444-8444-000000000002', '22222222-2222-4222-8222-000000000001',
   'in person', null, 'swiss', 5, 19, 1.0, false, 'results_imported'),
  ('Season II Wrap-up Gauntlet', 'season-ii-wrap-up-gauntlet', '2026-08-29',
   '44444444-4444-4444-8444-000000000002', '22222222-2222-4222-8222-000000000001',
   'Challonge', 'https://challonge.com/ps_wrap_ii', 'swiss', 5, 40, 1.0, false, 'awaiting_results'),

  -- Season III, still being set up. Hidden from the public-read policy.
  ('Season III Opener', 'season-iii-opener', '2026-09-26',
   '44444444-4444-4444-8444-000000000003', '22222222-2222-4222-8222-000000000001',
   'Challonge', null, 'swiss', null, null, 1.0, false, 'draft');
