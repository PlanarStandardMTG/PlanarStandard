import type { PostKind } from "@ps/contracts";

import { cardEmbed } from "../embed-card/index";
import { decklistEmbed } from "../embed-decklist/index";
import { imageEmbed } from "../embed-image/index";
import type { RegisteredEmbed } from "../embed-registry/index";
import { tournamentEmbed } from "../embed-tournament/index";

/**
 * Every component a post may place (E20.23).
 *
 * Adding one:
 *   1. `core/content/embed-<name>/` — `defineEmbed(...)`, with its parser, the
 *      kinds of post it may go in, an export for every target, and tests.
 *   2. Add it to `EMBEDS` below.
 *   3. Its site renderer in `web/components/content/embeds/renderers.tsx`; the
 *      type there requires one for every name here, and a test checks it.
 */
export const EMBEDS = [
  imageEmbed,
  decklistEmbed,
  tournamentEmbed,
  cardEmbed,
] as const satisfies readonly RegisteredEmbed[];

export type EmbedName = (typeof EMBEDS)[number]["name"];

/** `EMBEDS` for code that needs the list rather than its names. */
export const EMBED_REGISTRY: readonly RegisteredEmbed[] = EMBEDS;

/** The components a post of this kind may place. */
export function embedsFor(kind: PostKind): readonly RegisteredEmbed[] {
  return EMBED_REGISTRY.filter((embed) => embed.kinds.includes(kind));
}
