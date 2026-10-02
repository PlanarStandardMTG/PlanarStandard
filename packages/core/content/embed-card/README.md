# embed-card

**Purpose.** The `:::card{name inline}` component: one card in a post, as its
image or, with `inline="true"`, as its name within a sentence.

**Inputs.** The call's attributes, and the card the site resolved (its name,
Scryfall page and image). **Outputs.** `cardEmbed`, `parseCardEmbed`, and
`scryfallSearchUrl` for a name that did not resolve.

**Gotchas.** Parsing only checks a name is there; resolving it needs the card
index, which the site's loader has and core does not. An unresolved name is
shown as missing on the site and exported as a Scryfall exact-name search.

Policy: [`docs/modules/content.md`](../../../../docs/modules/content.md).
