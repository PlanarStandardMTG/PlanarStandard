-- The leaderboard's event threshold counts rated events from any season, not
-- only the current one: a new season would otherwise have an empty ladder
-- until its second Monthly, and the threshold is there to say a player is not
-- brand new, which a past season says as well. A bye is not playing.

create or replace view leaderboard with (security_invoker = true) as
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
  and (
    select count(distinct m.tournament_id)
    from matches m
    join tournaments t on t.id = m.tournament_id
    join player_identities i on i.id in (m.p1_identity_id, m.p2_identity_id)
    where i.player_id = p.id
      and t.is_rated
      and t.status in ('results_imported', 'verified')
      and m.result <> 'bye'
  ) >= (select min_events_for_leaderboard from rating_config where id = 1);
