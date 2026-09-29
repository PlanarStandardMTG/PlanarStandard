# post-reaction

**Purpose.** The reactions a post offers, and what a click on one does (E20.41).

**Inputs.** Count rows from `post_reaction_counts`, or the member's current reaction and the one clicked.
**Outputs.** `POST_REACTIONS` in display order · `isPostReaction` · `tallyReactions` → every kind
with zeros filled · `toggledReaction` → the new reaction, or null to take it back.

**Gotchas.** The list must match what `post_reactions` accepts: the enum from migration 0032, narrowed
to a thumbs up by the check in 0043. A retired kind in a count row is dropped.
