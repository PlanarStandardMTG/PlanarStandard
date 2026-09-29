-- E20.49 — a thumbs up is the only reaction.
--
-- The five colours are retired. A member who had reacted with one keeps a
-- thumbs up instead, and the check stops a colour being stored again. The enum
-- keeps its values: Postgres cannot drop one without rebuilding the type.

update post_reactions set reaction = 'thumbs_up' where reaction <> 'thumbs_up';

alter table post_reactions
  add constraint post_reactions_thumbs_up_only check (reaction = 'thumbs_up');
