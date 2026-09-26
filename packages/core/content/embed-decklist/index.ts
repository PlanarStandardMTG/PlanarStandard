import type { DeckCard } from "@ps/contracts";

import { defineEmbed, type EmbedParse } from "../embed-registry/index";

/**
 * `:::decklist{id="…" title="…"}` — one deck in a post (E20.24).
 *
 * The site shows the list by section with card previews. Reddit gets a link
 * and the list itself, as an indented block so every line survives and a
 * reader can paste it straight into a client. Discord gets the link and the
 * count; a list is too long for a message.
 */
export interface DecklistEmbed {
  readonly id: string;
  readonly title: string | null;
}

/** What the site loads for a deck, and all an export needs of it. */
export interface DecklistEmbedData {
  readonly name: string;
  readonly cards: readonly Pick<DeckCard, "quantity" | "name" | "board">[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseDeckId(raw: string | undefined, attribute: string): EmbedParse<string> {
  const id = raw?.trim() ?? "";
  if (id === "") return { ok: false, problem: "needs a deck id" };
  if (!UUID.test(id)) return { ok: false, problem: `${attribute} must be a deck id` };
  return { ok: true, value: id.toLowerCase() };
}

export function parseDecklistEmbed(
  raw: Readonly<Record<string, string>>,
): EmbedParse<DecklistEmbed> {
  const id = parseDeckId(raw["id"], "id");
  if (!id.ok) return id;
  const title = raw["title"]?.trim() ?? "";
  return { ok: true, value: { id: id.value, title: title === "" ? null : title } };
}

export const deckHref = (origin: string, id: string) => `${origin}/decks/${id}`;

const count = (deck: DecklistEmbedData, board: string) =>
  deck.cards.filter((c) => c.board === board).reduce((n, c) => n + c.quantity, 0);

/** "60 cards, 15 sideboard". */
export function deckCounts(deck: DecklistEmbedData): string {
  const side = count(deck, "side");
  return `${count(deck, "main") + count(deck, "command")} cards${side > 0 ? `, ${side} sideboard` : ""}`;
}

/**
 * The list as an indented Markdown block: main deck, then any commander and
 * sideboard under their own line, the shape the deck importer reads back.
 */
export function deckListBlock(deck: DecklistEmbedData): string {
  const lines = (board: string) =>
    deck.cards.filter((c) => c.board === board).map((c) => `${c.quantity} ${c.name}`);
  const extra = (label: string, board: string) => {
    const found = lines(board);
    return found.length === 0 ? [] : ["", label, ...found];
  };
  return [...lines("main"), ...extra("Commander", "command"), ...extra("Sideboard", "side")]
    .map((line) => (line === "" ? "" : `    ${line}`))
    .join("\n");
}

export const decklistEmbed = defineEmbed<"decklist", DecklistEmbed, DecklistEmbedData>({
  name: "decklist",
  label: "Decklist",
  description: "One of your decks, or any deck by its id.",
  attributes: [
    { name: "id", required: true, description: "The deck's id, from its page's address." },
    { name: "title", required: false, description: "A heading to use instead of its name." },
  ],
  parse: parseDecklistEmbed,
  export: {
    reddit: ({ id, title }, deck, { origin }) =>
      deck === null
        ? `[${title ?? "Decklist"}](${deckHref(origin, id)})`
        : `**[${title ?? deck.name}](${deckHref(origin, id)})** · ${deckCounts(deck)}\n\n${deckListBlock(deck)}`,
    discord: ({ id, title }, deck, { origin }) =>
      deck === null
        ? `${title ?? "Decklist"}: ${deckHref(origin, id)}`
        : `**${title ?? deck.name}** · ${deckCounts(deck)}: ${deckHref(origin, id)}`,
  },
});
