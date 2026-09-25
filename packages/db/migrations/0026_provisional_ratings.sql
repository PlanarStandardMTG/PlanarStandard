-- E20.12 — a ladder that shows something in its first month.
--
-- The ladder is season-scoped and only Monthlies are rated (E18.12, E8.7), so a
-- player sees about five rated matches a month. At 15 and 10 nobody would rank
-- until the third Monthly. `rating_config` is data, and this is the edit —
-- carried as a migration only because there is no admin screen for it yet, and
-- `db push` is how production gets it.

update rating_config
set provisional_matches = 5, min_matches_for_leaderboard = 5
where id = 1;

alter table rating_config
  alter column provisional_matches set default 5,
  alter column min_matches_for_leaderboard set default 5;

-- Everyone rated this season who is not on `leaderboard` yet, for the page's
-- second table. The visibility half of the `where` is `leaderboard`'s exactly —
-- a hidden or merged player is absent from both — and the other half is its
-- negation, so every shown player is in exactly one of the two.
create view provisional_ratings with (security_invoker = true) as
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
  r.last_played,
  r.is_active
from player_ratings r
join players p on p.id = r.player_id
where p.visibility = 'public'
  and p.merged_into is null
  and (
    r.is_provisional
    or r.matches_played < (select min_matches_for_leaderboard from rating_config where id = 1)
  );
