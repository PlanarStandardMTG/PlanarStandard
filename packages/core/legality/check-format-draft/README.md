# check-format-draft

**Purpose.** Decide whether what an admin typed is a format version that can be saved.

**Inputs.** The form's fields as strings — name, dates, notes, legal set codes, the four deck limits,
singleton, whether it is current — and its card rule rows by card name; the `CardIndex`.

**Outputs.** A `FormatVersionDraft` with every card rule resolved to an oracle id, or every problem
found, coded, so the page words them.

**Gotchas.** A card name that does not resolve is a problem with suggestions, never a guess — a ban on
the wrong card is worse than none. Blank rule rows are the form's spare rows and are skipped. Set codes
are upper-cased and de-duplicated; whether a set is in the card dataset is the form's concern, since a
pool may name a set before the dataset is refreshed.

`pnpm --filter core test -- legality`
