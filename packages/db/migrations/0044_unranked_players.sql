-- E20.50 — a player ranks after one rated event, and everyone else who has
-- played is listed after the ladder as unranked rather than left off it.

update rating_config set min_events_for_leaderboard = 1 where id = 1;
alter table rating_config alter column min_events_for_leaderboard set default 1;

-- Anyone public who has an entry in a published event and is not on
-- `leaderboard`: an unrated event, or rated ones outside Elo's dates. Defined
-- against the view rather than its predicate, so the two lists cannot overlap
-- or leave a gap between them.
create view unranked_players with (security_invoker = true) as
select
  p.id,
  p.slug,
  p.display_name,
  max(t.event_date) as last_played
from players p
join tournament_entries e on e.player_id = p.id
join tournaments t on t.id = e.tournament_id
where p.visibility = 'public'
  and p.merged_into is null
  and t.status <> 'draft'
  and not exists (select 1 from leaderboard l where l.id = p.id)
group by p.id;
