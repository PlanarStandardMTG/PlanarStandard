-- E20.44 — a player ranks after two events, and nobody is provisional.
--
-- Everyone enters the format on equal footing, so the first matches move a
-- rating by the same K as any other: `provisional_matches = 0` turns the tier
-- off without touching `core/elo`. The leaderboard threshold becomes events
-- played rather than matches, and the page no longer lists who is below it, so
-- `provisional_ratings` goes. A recompute after this lands rewrites every
-- rating under the new K.

update rating_config set provisional_matches = 0 where id = 1;
alter table rating_config alter column provisional_matches set default 0;

alter table rating_config rename column min_matches_for_leaderboard to min_events_for_leaderboard;
update rating_config set min_events_for_leaderboard = 2 where id = 1;
alter table rating_config alter column min_events_for_leaderboard set default 2;

drop view provisional_ratings;
drop view leaderboard;

create view leaderboard with (security_invoker = true) as
select
  p.id,
  p.slug,
  p.display_name,
  r.rating,
  r.peak_rating,
  r.matches_played,
  r.wins,
  r.losses,
  r.draws,
  r.tournaments_played,
  r.last_played
from player_ratings r
join players p on p.id = r.player_id
where p.visibility = 'public'
  and p.merged_into is null
  and r.tournaments_played >= (select min_events_for_leaderboard from rating_config where id = 1);
