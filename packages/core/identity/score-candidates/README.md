# score-candidates

**Purpose.** Score every pair of handles and rank the plausible merges.

**Inputs.** The candidates, the exclusions, and optionally a signal list and a
confidence floor.

**Outputs.** `MergeCandidate[]`, most confident first.

**Gotchas.** Signals combine by **noisy-OR** — `1 - product(1 - confidence)` —
treating each as independent evidence. Two weak signals beat one weak signal, and
nothing short of a certain signal reaches 1.

**An exclusion zeroes the candidate** however strong the signals are, and the
candidate is still returned so a reviewer sees why it looked plausible. Handles
already on one player are skipped: there is nothing to merge.

Candidates are sorted by identity before pairing, so the ranking depends on the
data rather than on input order.

Adding a signal is one line in `SIGNALS` — see `../README.md`.

`pnpm --filter core test -- score-candidates`
