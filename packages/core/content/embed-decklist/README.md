# embed-decklist

**Purpose.** The `:::decklist{id title}` component: one deck in a post.

**Inputs.** The call's attributes, and the deck the site loaded (name and cards).
**Outputs.** `decklistEmbed`; `deckListBlock`, `deckCounts`, `deckHref` and
`parseDeckId`, which the tournament component reuses for its deck.

**Gotchas.** Reddit gets the list as a four-space indented block: plain lines
would run together into one paragraph, and a block pastes straight into a
client. Discord gets only the link and the count. With no deck loaded — it was
deleted, or it is private to someone else — both exports are a link.

Policy: [`docs/modules/content.md`](../../../../docs/modules/content.md).
