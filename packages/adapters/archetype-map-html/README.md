# Archetype map html

**Purpose.** Read the community archetype map's decklists back out of it.

**Inputs.** A `RawInput` holding `InteractiveArchetypeMap*.html` — a Plotly
scatter whose every point carries one decklist in its hover text.

**Outputs.** A `ParsedEvent` with `decklists`: handle, date, both records as
printed, the archetype label, and the unparsed list.

**Gotchas.** The map is not an event — it is 35 of them in one file, which is
why the date and the records ride on each `ParsedDecklistEntry` rather than on
the event. The title separator is an **em dash** (`—`), not a hyphen, and a
handle may contain hyphens, so splitting on `-` mis-reads half the file. The
`"text"` arrays are found by scanning brackets rather than by regex, because a
decklist line is free text inside a JSON string. Records are passed through as
printed (`2-3-0`, `7-7`): `core/decklist/parse-filename` owns that grammar.
`archetypeRaw` keeps the whole printed label, family parenthesis included, since
it is matched to an archetype later and never trusted as one. The hover text has
no sideboard boundary and sorts all 75 cards alphabetically, so `decklistText`
is one merged board: which fifteen were the sideboard is not in the file.

`pnpm --filter adapters test -- archetype-map-html`
