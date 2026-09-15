# resolve-format

**Purpose.** Flatten the four `format_*` tables into one object the checkers read.

**Inputs.** The rows for one format version. **Outputs.** `FormatRules`.

**Gotchas.** `ReadonlySet` and `ReadonlyMap`, not arrays: `check-deck` asks about
every card in a 75, and a scan per card is a scan too many.

Legal set codes are lower-cased on the way in, so every comparison against a
decklist's `(TDM)` or `(fdn)` matches.

Defaults are 60 minimum maindeck, 15 maximum sideboard, 4 copies, not singleton
(Part IX, answer 2), overridable per format version so a special event can define
its own rules without a deploy.

`pnpm --filter core test -- legality`
