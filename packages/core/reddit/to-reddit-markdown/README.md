# to-reddit-markdown

**Purpose.** The whole Reddit pipeline, plus the canonical backlink.

**Inputs.** `RedditConversionInput` — the Markdown and the canonical URL.

**Outputs.** Reddit-safe Markdown ending in the backlink.

**Gotchas.** **Idempotent**, which is the acceptance criterion: "Copy for Reddit"
is a button a writer presses twice. A backlink this pipeline added earlier is
stripped before the run and re-appended after, so it never stacks.

Order is load-bearing: shortcodes expand into Markdown links, so they go first;
`absolutize-links` goes last so it catches everything the earlier steps produced.

Fixtures: `fixtures/reddit/to-reddit-markdown.{in,out}.md`.
