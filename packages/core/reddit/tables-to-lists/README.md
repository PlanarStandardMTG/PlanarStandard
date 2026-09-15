# tables-to-lists

**Purpose.** Flatten a Markdown table into a list.

**Inputs.** Markdown. **Outputs.** Markdown with every GFM table replaced.

**Gotchas.** Reddit renders tables inconsistently and old.reddit does not render
them at all, so a metagame table published as-is is unreadable for a large share
of the audience. The first column becomes the item and the rest become
`Header: value` pairs, which keeps each number attached to its meaning — a bare
list of figures is worse than the table was.

Empty cells are dropped rather than rendered as `Header: `. A table with a header
row and no body leaves its headings behind rather than vanishing.

Fixtures: `fixtures/reddit/tables-to-lists.{in,out}.md`.
