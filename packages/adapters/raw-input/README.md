# Raw input

**Purpose.** Get at what an upload actually contains.

**Inputs.** A `RawInput`.

**Outputs.** Its decoded text, its file extension, and its declared media type,
each normalised.

**Gotchas.** `text` wins over `bytes` when the caller supplied one — a paste
arrives already decoded and re-encoding it to decode it again is waste. The
byte-order mark is stripped here as well as in `parse-csv`, because a BOM
prefixed to `{` is enough to make `JSON.parse` throw on a file that is
perfectly good JSON. `mediaType` is what the _client_ declared, so it is a hint
and never the deciding evidence in a `detect`.

`pnpm --filter adapters test -- raw-input`
