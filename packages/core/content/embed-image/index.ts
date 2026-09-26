import { defineEmbed, type EmbedParse } from "../embed-registry/index";

/**
 * `:::image{src="…" alt="…" caption="…"}` — a picture in a post (E20.25).
 *
 * `src` is any web address: an upload to the site's own storage, or an image
 * hosted elsewhere. Reddit and Discord cannot show one inline in a text post,
 * so both get the address — Reddit as a link named by the alt text, Discord
 * bare on its own line, which it unfurls into a preview.
 */
export interface ImageEmbed {
  readonly src: string;
  readonly alt: string;
  readonly caption: string | null;
}

const WEB_ADDRESS = /^https?:\/\/[^\s"<>]+$/i;

export function parseImageEmbed(raw: Readonly<Record<string, string>>): EmbedParse<ImageEmbed> {
  const src = raw["src"]?.trim() ?? "";
  const alt = raw["alt"]?.trim() ?? "";
  const caption = raw["caption"]?.trim() ?? "";

  if (src === "") return { ok: false, problem: "needs a src" };
  if (!WEB_ADDRESS.test(src)) return { ok: false, problem: "src must be a web address" };
  if (alt === "") return { ok: false, problem: "needs alt text, for readers who cannot see it" };
  return { ok: true, value: { src, alt, caption: caption === "" ? null : caption } };
}

export const imageEmbed = defineEmbed<"image", ImageEmbed, null>({
  name: "image",
  label: "Image",
  description: "A picture, uploaded or from a link, with alt text and an optional caption.",
  attributes: [
    { name: "src", required: true, description: "The image's web address." },
    { name: "alt", required: true, description: "What the image shows, for screen readers." },
    { name: "caption", required: false, description: "A line shown under the image." },
  ],
  parse: parseImageEmbed,
  export: {
    reddit: ({ src, alt, caption }) =>
      [`[Image: ${alt}](${src})`, ...(caption === null ? [] : [`*${caption}*`])].join("\n\n"),
    discord: ({ src, caption }) => [src, ...(caption === null ? [] : [`*${caption}*`])].join("\n"),
  },
});
