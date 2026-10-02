# embed-syntax

**Purpose.** Find the lines where an article places a component.

**Inputs.** Markdown. **Outputs.** `EmbedCall`s (`name`, `attributes`, `source`),
or the Markdown with each call rewritten.

**Gotchas.** A call is `:::name{key="value"}` alone on its line, the shape
`:::chart{…}` already had, so a post stays plain Markdown (ADR 001); one marked
`inline="true"` may sit inside a sentence instead. Fenced code and code spans
are skipped. Values cannot contain a double quote; `formatEmbed`
drops them rather than invent an escape nothing else reads.

Policy: [`docs/modules/content.md`](../../../../docs/modules/content.md).
