# site-run

**Purpose.** A run played on the site (E26, §28), finished and handed to `ingest-event` like any results source (ADR 005, ADR 015).

**Inputs.** `siteRunInput` turns a `FinishedRun` into a `RawInput` of JSON; `parse` reads it back.

**Outputs.** The `ParsedEvent` `core/runs/to-parsed-event` makes: matches, standings, roster, decklists.

**Gotchas.** The document labels itself (`"adapter": "site-run"`), as `manual-entry` does,
since we write it. Ingest hashes the bytes, so the same run encodes the same way: finishing
twice writes nothing, and a correction supersedes. Not in `defaultRegistry`, because nobody
uploads one — the site makes it when an organizer finishes a run.
