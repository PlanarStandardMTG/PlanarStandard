# build-card-index

**Purpose.** Turn the loaded dataset into the lookup maps everything else uses.

**Inputs.** A `CardDataset` — the parsed `data/cards/` artifact, passed in.
**Outputs.** `CardIndex`: by oracle id, by normalized name, by legal set.

**Gotchas.** **No file I/O.** `core` never reads a file; loading the artifact is a
`jobs`/`web` concern (E4.7). A test reads this module's own source and fails if
`node:fs` appears in it.

Names are keyed by `normalize-name` output, **and each face is keyed separately**
— a decklist may write `Marang River Regent / Coil and Catch` or just
`Marang River Regent`, and both must reach the same card. A face name can collide
with another card's whole name, which is why the map holds a list rather than a
single id.

`bySet` is keyed by the sets the card is **legal** through, lower-cased. Set codes
arrive upper (`(TDM)`), lower (`(fdn)`) and as promo sets (`PTDM`), so every
lookup goes through `normalizeSetCode`.

`pnpm --filter core test -- legality`
