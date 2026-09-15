# expand-chart-shortcodes

**Purpose.** Turn a `:::chart{...}` embed into a link plus a PNG link.

**Inputs.** Markdown and the canonical URL. **Outputs.** Markdown.

**Gotchas.** Reddit cannot run a live chart, so the reader gets the rendered PNG
inline-adjacent and the interactive version one click away. A shortcode with no
`id` is left exactly as written rather than expanded into a broken link — a typo
should be visible, not silently swallowed.

Runs first in the pipeline, because it expands into Markdown links that
`absolutize-links` then has to see.

Fixtures: `fixtures/reddit/expand-chart-shortcodes.{in,out}.md`.
