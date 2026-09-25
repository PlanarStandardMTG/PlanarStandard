# pick-printing

**Purpose.** Choose which printing of a card a deck page shows.

**Inputs.** The card's `CardIndexEntry`, and the set and collector number the decklist line named,
if any.

**Outputs.** A `CardPrinting` (or null for a card with none). `frontImage` gives its picture,
falling back to the front face of a two-faced card.

**Gotchas.** Display only. Legality never depends on the printing (ADR 007), so a named printing
missing from the dataset quietly falls back to the first paper, non-promo one with an image.

`pnpm --filter core test -- pick-printing`
