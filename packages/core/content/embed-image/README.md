# embed-image

**Purpose.** The `:::image{src alt caption}` component: a picture in a post.

**Inputs.** The call's attributes. **Outputs.** `imageEmbed`, a `RegisteredEmbed`;
`parseImageEmbed` for the site renderer.

**Gotchas.** `src` must be an `http(s)` address — an upload's public URL or an
image hosted elsewhere — and alt text is required. Neither export target can
show an image inline in a text post: Reddit gets a link named by the alt text,
Discord the bare address, which it unfurls.

Policy: [`docs/modules/content.md`](../../../../docs/modules/content.md).
