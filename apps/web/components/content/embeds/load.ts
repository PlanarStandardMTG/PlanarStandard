import { EMBED_REGISTRY, findEmbeds, type EmbedData } from "@ps/core";

import { EMBED_RENDERERS, type EmbedRenderer } from "./renderers";

const RENDERERS: Readonly<Record<string, EmbedRenderer>> = EMBED_RENDERERS;
const LIVE = new Map(EMBED_REGISTRY.map((embed) => [embed.name, embed]));

/** Load the data a component needs, or null when it has no loader, bad attributes, or fails. */
export async function loadEmbed(
  name: string,
  attributes: Readonly<Record<string, string>>,
): Promise<unknown> {
  const renderer = RENDERERS[name];
  const embed = LIVE.get(name);
  if (renderer?.load === undefined || embed === undefined) return null;
  if (embed.check(attributes) !== null) return null;

  try {
    return await renderer.load(attributes);
  } catch {
    // An export falls back to a link rather than failing the whole post.
    return null;
  }
}

/** Everything a post's components load, keyed by source line, for `exportPost`. */
export async function loadEmbedData(markdown: string): Promise<EmbedData> {
  const calls = findEmbeds(markdown);
  const entries = await Promise.all(
    calls.map(async (call) => [call.source, await loadEmbed(call.name, call.attributes)] as const),
  );
  return new Map(entries.filter(([, data]) => data !== null));
}
