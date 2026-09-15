# Parse csv

**Purpose.** Read delimited text into rows.

**Inputs.** The decoded file, and optionally the delimiter when the caller
already knows it.

**Outputs.** `CsvTable` — the delimiter used and every row, header included, in
source order.

**Gotchas.** Fields are returned verbatim: trimming, header lookup and type
coercion belong to the adapter, which knows what each column means. The
delimiter is sniffed by which one produces the widest _consistent_ table rather
than by counting separators on the first line, because an event name containing
a comma otherwise turns every TSV into a two-column CSV. A `"` only quotes a
field when it opens one, so `Vault 5" Tall` survives a spreadsheet export.
Trailing blank lines are dropped; interior ones are kept, since a blank row in
the middle of a standings block is a real row the operator should see.

`pnpm --filter adapters test -- parse-csv`
