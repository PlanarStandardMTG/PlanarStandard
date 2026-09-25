import type { Board } from "@ps/contracts";

/**
 * A deck split into the sections a decklist is read in: the maindeck by card
 * type, then the sideboard whole.
 *
 * A card goes in exactly one section, decided by its front face's type line
 * and the order below: a land that is also something else is a land (it is
 * played as one), an artifact creature is a creature. A card with no type line
 * — its name never resolved — goes in `unknown` rather than being guessed into
 * a section.
 */
export type DeckSectionKey =
  | "command"
  | "creature"
  | "planeswalker"
  | "battle"
  | "instant"
  | "sorcery"
  | "artifact"
  | "enchantment"
  | "other"
  | "land"
  | "unknown"
  | "sideboard";

const MAINDECK_TYPES: ReadonlyArray<readonly [RegExp, DeckSectionKey]> = [
  [/\bLand\b/, "land"],
  [/\bCreature\b/, "creature"],
  [/\bPlaneswalker\b/, "planeswalker"],
  [/\bBattle\b/, "battle"],
  [/\bInstant\b/, "instant"],
  [/\bSorcery\b/, "sorcery"],
  [/\bArtifact\b/, "artifact"],
  [/\bEnchantment\b/, "enchantment"],
];

const ORDER: readonly DeckSectionKey[] = [
  "command",
  "creature",
  "planeswalker",
  "battle",
  "instant",
  "sorcery",
  "artifact",
  "enchantment",
  "other",
  "land",
  "unknown",
  "sideboard",
];

export interface SectionCard {
  readonly qty: number;
  readonly board: Board;
}

export interface DeckSection<T extends SectionCard> {
  readonly key: DeckSectionKey;
  readonly cards: readonly T[];
  /** Copies, not lines. */
  readonly count: number;
}

/** The section one maindeck card belongs in, from its type line. */
export function sectionOf(typeLine: string | null): DeckSectionKey {
  if (typeLine === null) return "unknown";
  const front = typeLine.split(" // ")[0] ?? typeLine;
  return MAINDECK_TYPES.find(([pattern]) => pattern.test(front))?.[1] ?? "other";
}

/** Non-empty sections only, in reading order; cards keep their order within one. */
export function deckSections<T extends SectionCard>(
  cards: readonly T[],
  typeLineOf: (card: T) => string | null,
): readonly DeckSection<T>[] {
  const buckets = new Map<DeckSectionKey, T[]>();
  for (const card of cards) {
    const key =
      card.board === "side"
        ? "sideboard"
        : card.board === "command"
          ? "command"
          : sectionOf(typeLineOf(card));
    const bucket = buckets.get(key) ?? [];
    bucket.push(card);
    buckets.set(key, bucket);
  }

  return ORDER.flatMap((key) => {
    const bucket = buckets.get(key);
    if (bucket === undefined) return [];
    return [{ key, cards: bucket, count: bucket.reduce((total, card) => total + card.qty, 0) }];
  });
}
