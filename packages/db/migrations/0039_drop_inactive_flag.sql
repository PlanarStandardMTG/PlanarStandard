-- A player is no longer marked inactive: nothing shows it, and the ladder is
-- season-scoped, so a long absence already ends with the season.

alter table player_ratings drop column is_active;
alter table rating_config drop column inactive_after_days;
