import { defineEmbed, type EmbedParse } from "../embed-registry/index";

/**
 * `:::card{name="…"}` — one card in a post (E20.26).
 *
 * The site shows Scryfall's image of it, linked to its Scryfall page; marked
 * `inline="true"`, it is the card's name in the sentence instead, with the
 * image on hover (E20.58). Reddit and Discord get the name linked to the same
 * page either way. The name is resolved
 * against the card index when the site loads it, so a misspelling shows as a
 * missing card rather than failing the post.
 */
export interface CardEmbed {
  readonly name: string;
}

/** What the site resolved the name to. */
export interface CardEmbedData {
  readonly name: string;
  readonly scryfallUrl: string;
  /** Scryfall's `normal` image. Null for a printing with none. */
  readonly image: string | null;
}

export function parseCardEmbed(raw: Readonly<Record<string, string>>): EmbedParse<CardEmbed> {
  const name = raw["name"]?.trim() ?? "";
  return name === "" ? { ok: false, problem: "needs a card name" } : { ok: true, value: { name } };
}

/** Scryfall's exact-name search, for a card the index could not resolve. */
export const scryfallSearchUrl = (name: string) =>
  `https://scryfall.com/search?q=${encodeURIComponent(`!"${name}"`)}`;

const target = ({ name }: CardEmbed, card: CardEmbedData | null) =>
  card === null
    ? { text: name, url: scryfallSearchUrl(name) }
    : { text: card.name, url: card.scryfallUrl };

export const cardEmbed = defineEmbed<"card", CardEmbed, CardEmbedData>({
  name: "card",
  label: "Card",
  description: "A card's image, by name, linked to its Scryfall page.",
  attributes: [
    { name: "name", required: true, description: "The card's name." },
    {
      name: "inline",
      required: false,
      description: '"true" for the name as a link within a sentence, its image on hover.',
    },
  ],
  kinds: ["official", "community"],
  inline: true,
  parse: parseCardEmbed,
  export: {
    reddit: (embed, card) => {
      const { text, url } = target(embed, card);
      return `[${text}](${url})`;
    },
    // Discord renders a masked link in a message; the angle brackets stop it unfurling.
    discord: (embed, card) => {
      const { text, url } = target(embed, card);
      return `[${text}](<${url}>)`;
    },
  },
});
