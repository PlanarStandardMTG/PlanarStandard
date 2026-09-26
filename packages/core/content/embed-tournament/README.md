# embed-tournament

**Purpose.** The `:::tournament{slug show deck player}` component: an event's
winner, top 2 or top 4 in a post, optionally with a deck.

**Inputs.** The call's attributes, and what the site loaded: the event, its
finishers within `show`, and the deck. **Outputs.** `tournamentEmbed`, and
`TOURNAMENT_SHOW`, `ordinal`, `formatRecord`, `longDate`, `deckOwner` for the
site renderer.

**Gotchas.** `player` attaches the deck to that finisher; without it the deck
is paired with the event. The site shows one card, but both exports write the
event and then the deck separately, the deck the way `embed-decklist` does.
Tied places (two 3rds from a playoff) are both shown. No standings is a line
saying so, not an empty list.

Policy: [`docs/modules/content.md`](../../../../docs/modules/content.md).
