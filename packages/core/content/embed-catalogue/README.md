# embed-catalogue

**Purpose.** List the components an article may place, and the ones planned.

**Inputs.** None. **Outputs.** `EMBEDS` (live, each a `RegisteredEmbed`),
`EmbedName`, and `PLANNED_EMBEDS` — what is coming and how each will export.

**Gotchas.** Live: image, decklist, tournament. The steps for adding one are at the top of `index.ts`; the site renderer is the
step that lives in `web`, and its type will not compile without it.

Policy: [`docs/modules/content.md`](../../../../docs/modules/content.md).
