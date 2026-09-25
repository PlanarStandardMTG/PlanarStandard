# export-post

**Purpose.** Write a post body out for Reddit or Discord.

**Inputs.** The Markdown, its canonical URL, the component registry, and any
data the site loaded for those components. **Outputs.** Markdown for the target.

**Gotchas.** Components expand first, each through its own export, then the
platform pipeline runs over the result. Reddit's is `reddit/to-reddit-markdown`.
Discord's lives here: three heading levels, and a 2,000-character message cut at
a paragraph with the link to the full post always kept.

Policy: [`docs/modules/content.md`](../../../../docs/modules/content.md).
