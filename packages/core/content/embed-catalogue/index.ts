import { decklistEmbed } from "../embed-decklist/index";
import { imageEmbed } from "../embed-image/index";
import type { RegisteredEmbed } from "../embed-registry/index";
import { tournamentEmbed } from "../embed-tournament/index";

/**
 * Every component an article may place (E20.23), and the ones planned.
 *
 * Adding one:
 *   1. `core/content/embed-<name>/` — `defineEmbed(...)`, with its parser and an
 *      export for every target, and tests.
 *   2. Add it to `EMBEDS` below and remove it from `PLANNED_EMBEDS`.
 *   3. Its site renderer in `web/components/content/embeds/renderers.tsx`; the
 *      type there requires one for every name here, and a test checks it.
 */
export const EMBEDS = [
  imageEmbed,
  decklistEmbed,
  tournamentEmbed,
] as const satisfies readonly RegisteredEmbed[];

export type EmbedName = (typeof EMBEDS)[number]["name"];

/** `EMBEDS` for code that needs the list rather than its names. */
export const EMBED_REGISTRY: readonly RegisteredEmbed[] = EMBEDS;

/** What the editor lists as coming, and how each will leave the site. */
export interface PlannedEmbed {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly example: string;
  /** How it shows on the site, and what each export target gets instead. */
  readonly site: string;
  readonly reddit: string;
  readonly discord: string;
}

export const PLANNED_EMBEDS: readonly PlannedEmbed[] = [
  {
    name: "card",
    label: "Card",
    description: "A single card, by name.",
    example: ':::card{name="Llanowar Elves"}',
    site: "The card image and its Oracle text.",
    reddit: "The card name linked to its Scryfall page.",
    discord: "The card name linked to its Scryfall page.",
  },
  {
    name: "chart",
    label: "Chart",
    description: "A live metagame chart, by id.",
    example: ':::chart{id="meta-share" title="Metagame share"}',
    site: "The live chart (E17.4 / E19).",
    reddit:
      "A link to the chart and one to its PNG — already done by `reddit/expand-chart-shortcodes`.",
    discord: "The same two links.",
  },
];
