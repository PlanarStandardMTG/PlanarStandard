-- Seed: seasons.
--
-- The three the sample posts describe: Season I fortnightly through the spring,
-- Season II weekly and shorter, Season III about to open — which is also the
-- event `seed/0003_external_events.sql` has sitting at the top of `/events`.
--
-- Season III is `is_current` before its first event, because "current" is the
-- season the site scopes to, and after a wrap-up post that is the next one.

insert into seasons (id, name, ordinal, starts_on, ends_on, format_version_id, is_current) values
  ('44444444-4444-4444-8444-000000000001', 'Season I — Lorwyn Eclipsed', 1,
   '2026-01-21', '2026-04-18', '22222222-2222-4222-8222-000000000001', false),
  ('44444444-4444-4444-8444-000000000002', 'Season II', 2,
   '2026-05-09', '2026-08-29', '22222222-2222-4222-8222-000000000001', false),
  ('44444444-4444-4444-8444-000000000003', 'Season III', 3,
   '2026-09-26', null, '22222222-2222-4222-8222-000000000001', true);
