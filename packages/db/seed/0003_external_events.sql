-- Seed: the external event calendar.
--
-- Eight events across all three states and both calendars, so `/events` and the
-- home page's next-event tile are populated on a fresh clone with no credentials
-- — which is the only way most contributors will ever see either (E23.10).
--
-- Two of them are on melee.gg. Nothing fetches that calendar yet (E23.12), and
-- the rows are here anyway: the cache, the schedule and the page are all
-- source-agnostic, and a seed holding one source would let that quietly stop
-- being true.
--
-- Dates are relative to `now()` rather than fixed. A seed with hard-coded dates
-- shows an empty "upcoming" section to anyone who resets their database a month
-- after it was written, which is exactly the section the page exists for.
--
-- Every link here is invented and will 404, on both hosts. That is the honest
-- representation of a cache with no credentials behind it.

insert into external_events (source, external_id, name, url, state, starts_at, participant_count, structure, fetched_at) values
  ('challonge', 'seed-16042312', 'Blind Eternities Open',        'https://challonge.com/blind_eternities_open', 'live',      now() - interval '2 hours', 38, 'double elimination', now()),
  ('challonge', 'seed-16042315', 'Multiverse Cup',               'https://challonge.com/multiverse_cup',        'live',      now() - interval '1 hour',  48, 'swiss',              now()),
  ('challonge', 'seed-16042311', 'Planar Standard Weekly #41',   'https://challonge.com/ps_weekly_41',          'scheduled', now() + interval '5 days',  24, 'swiss',              now()),
  ('challonge', 'seed-16042318', 'Ambassador Invitational',      'https://challonge.com/ambassador_invitational','scheduled', now() + interval '19 days', 16, 'round robin',        now()),
  ('challonge', 'seed-16042317', 'Season III Opener',            null,                                          'scheduled', null,                       0,  'swiss',              now()),
  ('challonge', 'seed-16042314', 'Planar Standard Weekly #40',   'https://challonge.com/ps_weekly_40',          'complete',  now() - interval '9 days',  31, 'swiss',              now()),
  ('melee',     'seed-289410',   'Planar Standard Showdown',     'https://melee.gg/Tournament/View/289410',     'scheduled', now() + interval '2 days',  64, 'swiss',              now()),
  ('melee',     'seed-289377',   'Eclipse Series #3',            'https://melee.gg/Tournament/View/289377',     'complete',  now() - interval '4 days',  52, 'swiss + top 8',      now());

-- The sync ledger row is created by the migration. Backdating the last attempt
-- past the refresh interval means a local site with credentials set will fetch
-- on first view rather than sitting on the seed.
--
-- Only Challonge has a row. A ledger row is the right to spend a request, and
-- nothing fetches melee.gg yet — inventing one now would claim a budget against
-- a client that does not exist. E23.12 adds it with the client.
update external_event_syncs
   set last_attempted_at = now() - interval '1 day',
       last_succeeded_at = now() - interval '1 day',
       event_count = 6
 where source = 'challonge';
