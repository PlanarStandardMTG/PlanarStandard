/**
 * A member's decks as one entry per deck: the newest version of each, with how
 * many versions it has (E20.30). An edit writes a new row whose parent is the
 * one it replaced, so a deck is a chain of rows and its newest is the one no
 * other row names as a parent.
 */
export interface Versioned {
  readonly id: string;
  readonly parentDeckId: string | null;
}

export interface LatestVersion<T> {
  readonly deck: T;
  readonly versions: number;
}

export function latestVersions<T extends Versioned>(
  decks: readonly T[],
): readonly LatestVersion<T>[] {
  const byId = new Map(decks.map((deck) => [deck.id, deck]));
  const replaced = new Set(decks.map((deck) => deck.parentDeckId));

  return decks
    .filter((deck) => !replaced.has(deck.id))
    .map((deck) => {
      let versions = 1;
      let parent = deck.parentDeckId === null ? undefined : byId.get(deck.parentDeckId);
      while (parent !== undefined) {
        versions += 1;
        parent = parent.parentDeckId === null ? undefined : byId.get(parent.parentDeckId);
      }
      return { deck, versions };
    });
}
