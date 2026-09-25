import { cardIndex } from "@/lib/cards/card-index";
import type {
  CardIndex,
  Color,
  DeckWithCards,
  FormatVersionDetail,
  LegalityVerdict,
  ResolvedDeck,
} from "@ps/contracts";
import {
  checkDeck,
  colorIdentity,
  deckSections,
  frontImage,
  pickPrinting,
  resolveFormat,
  type DeckSection,
} from "@ps/core";

/**
 * A stored deck, shaped for its page: every line joined to the card index for
 * its type, cost and picture, then split into sections.
 *
 * A thin coordinator. The joins are lookups; which section, which printing and
 * whether it is legal are all `core`'s answers.
 */
export interface DeckViewCard {
  readonly qty: number;
  readonly name: string;
  readonly board: DeckWithCards["cards"][number]["board"];
  readonly resolved: boolean;
  readonly typeLine: string | null;
  readonly manaCost: string | null;
  readonly manaValue: number;
  /** Scryfall's `normal` image, uncropped. Null for an unresolved card. */
  readonly image: string | null;
  readonly scryfallUrl: string;
}

export interface DeckView {
  readonly sections: readonly DeckSection<DeckViewCard>[];
  readonly mainCount: number;
  readonly sideCount: number;
  readonly colors: readonly Color[];
  /** Null when there is no format in force to check against. */
  readonly verdict: LegalityVerdict | null;
}

export function toResolvedDeck(deck: DeckWithCards): ResolvedDeck {
  const cards = deck.cards.map((card, i) => ({
    qty: card.quantity,
    name: card.name,
    oracleId: card.oracleId,
    foil: false,
    board: card.board,
    lineNumber: i + 1,
  }));
  return { cards, issues: [], hasUnresolvedCards: cards.some((c) => c.oracleId === null) };
}

export function buildDeckView(
  deck: DeckWithCards,
  format: FormatVersionDetail | null,
  index: CardIndex = cardIndex(),
): DeckView {
  const cards = deck.cards
    .map((line): DeckViewCard => {
      const entry = line.oracleId === null ? undefined : index.byOracleId.get(line.oracleId);
      const printing =
        entry === undefined
          ? null
          : pickPrinting(entry, {
              ...(line.set === null ? {} : { set: line.set }),
              ...(line.collector === null ? {} : { collector: line.collector }),
            });
      const image = printing === null ? null : frontImage(printing);

      return {
        qty: line.quantity,
        name: entry?.card.name ?? line.name,
        board: line.board,
        resolved: entry !== undefined,
        typeLine: entry?.card.typeLine ?? null,
        manaCost: entry?.card.manaCost ?? entry?.card.faces?.[0]?.manaCost ?? null,
        manaValue: entry?.card.manaValue ?? 0,
        image: image?.normal ?? null,
        scryfallUrl:
          printing === null
            ? `https://scryfall.com/search?q=${encodeURIComponent(`!"${line.name}"`)}`
            : `https://scryfall.com/card/${printing.setCode}/${encodeURIComponent(printing.collectorNumber)}`,
      };
    })
    .sort((a, b) => a.manaValue - b.manaValue || a.name.localeCompare(b.name));

  const resolved = toResolvedDeck(deck);
  const count = (board: string) =>
    deck.cards.filter((c) => c.board === board).reduce((total, c) => total + c.quantity, 0);

  return {
    sections: deckSections(cards, (card) => card.typeLine),
    mainCount: count("main"),
    sideCount: count("side"),
    colors: colorIdentity(resolved, index),
    verdict:
      format === null
        ? null
        : checkDeck(
            resolved,
            resolveFormat({
              formatVersionId: format.version.id,
              legalSets: format.legalSets,
              cardRules: format.cardRules,
              ...(format.constraints === null ? {} : { constraints: format.constraints }),
            }),
            index,
          ),
  };
}
