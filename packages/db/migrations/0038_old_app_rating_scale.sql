-- Ratings on the old app's scale: everyone starts at 1000 and every match moves
-- a rating by K = 32. The elite tier takes the same K, so it no longer slows
-- anyone down. A recompute after this lands rewrites every rating.

update rating_config
set initial_rating = 1000, k_standard = 32, k_elite = 32
where id = 1;

alter table rating_config
  alter column initial_rating set default 1000,
  alter column k_standard set default 32,
  alter column k_elite set default 32;
