# strip-html

**Purpose.** Unwrap raw HTML, keeping the text inside it.

**Inputs.** Markdown. **Outputs.** Markdown with no tags.

**Gotchas.** Reddit drops raw HTML in self-posts, so an article that used a
little inline markup silently loses that content entirely. Block-level tags leave
a paragraph break behind; inline tags leave nothing, so `<em>word</em>` does not
become `word` with stray spacing. The blank line a leading comment or wrapper
`<div>` leaves at the top is removed, which also makes the transform idempotent.

The common named entities are decoded (`&amp;`, `&nbsp;`, `&lt;`, `&gt;`,
`&quot;`, `&#39;`); numeric entities are not, because none appear in practice.

Fixtures: `fixtures/reddit/strip-html.{in,out}.md`.
