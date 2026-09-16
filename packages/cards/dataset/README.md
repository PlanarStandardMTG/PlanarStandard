# dataset

**Purpose.** Load `data/cards/` into memory once per process, and hand back either
the parsed dataset or the built index.

**Inputs.** Optionally a directory URL, for tests and for a job pointing at a
freshly built artifact. Callers in the app pass nothing.
**Outputs.** `CardDataset`, or `CardIndex` from `core/legality/build-card-index`.

**Gotchas.** This is the **only** module in `packages/` that reads a file. It
exists because `core` does no file I/O and `web` cannot import `jobs`, so neither
of them is a place the loader could live (§5, §8).

Reads are synchronous on purpose: it happens once, and an async loader would make
every caller async to save a few milliseconds one time in the life of a process.

Both loaders memoize **per directory**, so a test can pass an explicit path and
get its own copy without a cache-clearing function existing for production code to
misuse.

`meta.json`'s counts are checked against the other two files on load. They are a
checksum: a truncated write or one file updated without the others fails here
rather than as a card that resolves on one machine and not another.

`pnpm --filter cards test`
