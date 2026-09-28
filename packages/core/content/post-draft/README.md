# post-draft

**Purpose.** Decide whether an author's input can be saved or submitted, and
give it a slug.

**Inputs.** The editor's raw fields, `save` or `submit`, the component
registry, and the post's kind. **Outputs.** A normalised `PostDraft`, or
problem codes per field · `postSlug(title)`.

**Gotchas.** A draft may be half-written; only a submission must have a body
and components that exist, parse, and are allowed in its kind of post.
Problems are codes, so the page owns the wording. `postSlug` can return empty — the caller supplies a fallback.

Policy: [`docs/modules/content.md`](../../../../docs/modules/content.md).
