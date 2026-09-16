# bulk-index

**Purpose.** Resolve the one bulk file to download, and hold the Scryfall request
etiquette in one place.

**Inputs.** `GET https://api.scryfall.com/bulk-data` — one request, the whole network
budget besides the file itself.
**Outputs.** `BulkSource { url, updatedAt, compressedSize }`, plus `SCRYFALL_HEADERS` and
`SCRYFALL_ATTRIBUTION`.

**Gotchas.** The type is **`default_cards`** — every printing, English. Not `oracle_cards`
(one Scryfall-chosen printing per oracle id, so a card reprinted into the pool keeps its
older printing and vanishes when you filter by set) and not `all_cards` (same rows in
every language, five times the bytes).

The field is **`jsonl_download_uri`** and the payload is **gzipped JSONL**, not a JSON
array. §14.1 was written against an older shape that served `download_uri` and a type
called "all-printings"; neither exists. `selectBulkSource` throws rather than falling
back, because that drift would otherwise land as a quietly wrong dataset.

Scryfall requires a `User-Agent` naming the app, not the HTTP library — undici sends its
own unless we set one.

`pnpm --filter jobs test -- bulk-index`
