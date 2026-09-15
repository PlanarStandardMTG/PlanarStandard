# absolutize-links

**Purpose.** Resolve root-relative links against the canonical origin.

**Inputs.** Markdown and the canonical URL. **Outputs.** Markdown.

**Gotchas.** `](/cards/stock-up)` is dead on Reddit — there is no site for it to
be relative to. Only **root-relative** paths are rewritten: an absolute URL is
left alone, and so is an `#anchor`, which would otherwise be broken rather than
fixed. A canonical URL with no scheme is tolerated, since it is configuration.

Runs last in the pipeline so it catches the relative links the earlier steps
produced.

Fixtures: `fixtures/reddit/absolutize-links.{in,out}.md`.
