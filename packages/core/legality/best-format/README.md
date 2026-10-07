# best-format

**Purpose.** Pick which of an event's format versions one of its decks is checked against.

**Inputs.** A `ResolvedDeck`, the event's versions as `FormatRules` in the event's order, `CardIndex`.
**Outputs.** The `FormatVersionId` of the first version the deck is legal in, else the event's first
with `legal: false`; null for an event with no version.

`pnpm --filter core test -- legality`
