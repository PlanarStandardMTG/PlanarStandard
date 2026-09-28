# embed-catalogue

**Purpose.** List the components a post may place, and which kinds of post may place each.

**Inputs.** None, or a `PostKind`. **Outputs.** `EMBEDS` (each a `RegisteredEmbed`),
`EmbedName`, `EMBED_REGISTRY`, and `embedsFor(kind)`.

**Gotchas.** Image and tournament are news only; decklist and card go anywhere.
The steps for adding one are at the top of `index.ts`; the site renderer is the
step that lives in `web`, and its type will not compile without it.

Policy: [`docs/modules/content.md`](../../../../docs/modules/content.md).
