/**
 * A member's decks as one entry per deck: the newest version of each, with how
 * many versions it has (E20.30), and those versions newest first. An edit writes a new row whose parent is the
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
  /** Every version given, `deck` first — what a deck's event record sums over. */
  readonly lineage: readonly T[];
}

export function latestVersions<T extends Versioned>(
  decks: readonly T[],
): readonly LatestVersion<T>[] {
  const byId = new Map(decks.map((deck) => [deck.id, deck]));
  const replaced = new Set(decks.map((deck) => deck.parentDeckId));

  return decks
    .filter((deck) => !replaced.has(deck.id))
    .map((deck) => {
      const lineage = [deck];
      let parent = deck.parentDeckId === null ? undefined : byId.get(deck.parentDeckId);
      while (parent !== undefined) {
        lineage.push(parent);
        parent = parent.parentDeckId === null ? undefined : byId.get(parent.parentDeckId);
      }
      return { deck, versions: lineage.length, lineage };
    });
}
