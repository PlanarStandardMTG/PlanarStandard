import type { CardImageUris, CardIndexEntry, CardPrinting, SetCode } from "@ps/contracts";

/**
 * Which printing to show for a card in a deck.
 *
 * The printing the list named, when it named one the dataset has; otherwise
 * the first paper, non-promo printing with an image; otherwise any printing
 * at all. This only picks a picture — legality never depends on which
 * printing is shown (ADR 007).
 */
export function pickPrinting(
  entry: CardIndexEntry,
  named: { readonly set?: SetCode; readonly collector?: string } = {},
): CardPrinting | null {
  const { printings } = entry;
  const set = named.set?.toLowerCase();

  if (set !== undefined) {
    const exact = printings.find(
      (p) =>
        p.setCode === set &&
        (named.collector === undefined || p.collectorNumber === named.collector),
    );
    if (exact !== undefined) return exact;
  }

  return (
    printings.find((p) => !p.promo && !p.digital && frontImage(p) !== null) ??
    printings.find((p) => frontImage(p) !== null) ??
    printings[0] ??
    null
  );
}

/** A printing's image, or its front face's for a card with two faces. */
export function frontImage(printing: CardPrinting): CardImageUris | null {
  return printing.imageUris ?? printing.faceImageUris?.[0] ?? null;
}
