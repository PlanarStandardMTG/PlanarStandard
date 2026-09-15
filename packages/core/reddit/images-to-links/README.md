# images-to-links

**Purpose.** Demote an inline image to an ordinary link.

**Inputs.** Markdown. **Outputs.** Markdown with no `![]()`.

**Gotchas.** A Reddit self-post cannot inline an image, so `![alt](url)` renders
as nothing at all — the reader does not get a broken image, they get silence.
The alt text becomes the link label so the reader knows what they are being
offered; an image with no alt text gets the label "image" rather than an empty
link. A title attribute is dropped.

Fixtures: `fixtures/reddit/images-to-links.{in,out}.md`.
