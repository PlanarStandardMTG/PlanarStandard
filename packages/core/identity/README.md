# core/identity

Works out which handles belong to the same person.

The ledger records **handles, not people** (ADR 003). A match says
`"c0d33" beat "Brayzon" 2-1`; who those are is a separate, mutable mapping
resolved at replay time. This module proposes entries for that mapping. It never
decides one — a human works the queue, and a merge is reversible.

Identities auto-create; curation is **merging, not claiming** (ADR 009). An
unseen handle is a new person until an admin says otherwise (Part IX, answer 6).

```
normalize-handle          the key everything matches on
signals/                  one file per kind of evidence  <- start here
co-appearance-exclusions  the hard "definitely not" facts
score-candidates          combines signals, applies exclusions, ranks
```

---

## Adding a signal

**This is the best first contribution in the repo**, and the module is shaped to
keep it that way: one new file, one line in a list, one test. No contract change,
no edit to any existing signal.

### 1. Write the file

`packages/core/identity/signals/<your-signal>/index.ts`:

```ts
import type { Signal } from "@ps/contracts";

import type { SignalContext, SignalScorer } from "../types";

/** What this signal is worth when it fires. */
export const CONFIDENCE = 0.45;

/**
 * One sentence on what this observes — and, more usefully, why it is worth
 * exactly this much and not more.
 */
export const yourSignal: SignalScorer = ({ a, b }: SignalContext): Signal | null => {
  if (!somethingIsTrue(a, b)) return null;

  return {
    kind: "your-signal",
    confidence: CONFIDENCE,
    evidence: { whateverAReviewerNeedsToSee: "..." },
  };
};
```

### 2. Register it

Add it to `SIGNALS` in `score-candidates/index.ts`. That is the whole wiring.

### 3. Test it

`index.test.ts` beside it. Cover the case it fires on, at least two it must stay
quiet on, and the shape of the evidence. Use real handles — `Basscannon` /
`BasscannonTtonka`, `DreamsAlong` / `Dreamsalong`, `Zaunus13 (LikoRS)` and
`divnyi (Mika)` are all genuinely in the data.

---

## The rules a signal follows

- **Return `null`, never a zero-confidence signal.** Silence and "I looked and
  found nothing" are the same thing to the combiner, and `null` keeps the
  evidence list to what actually fired.
- **`kind` is an open string.** The contract deliberately does not enumerate the
  signals, so a new one is never a breaking change.
- **`evidence` must survive a jsonb round trip.** It is stored verbatim in
  `merge_suggestions.evidence` and shown to whoever works the queue. No `Date`,
  no `undefined`, no `Map`.
- **Confidence is how much this *kind* of evidence is worth, not how strong this
  instance was.** `trigram` fires at a flat 0.6 and puts the measured similarity
  in the evidence. A reviewer can then compare two trigram hits; a sliding
  confidence would make every kind of evidence incomparable.
- **Be pure.** No I/O, no clock, no randomness. Everything a signal needs is on
  the `HandleObservation` it is handed; if yours needs something more, add a
  field there and let the caller gather it.
- **Deterministic and symmetric.** Swapping `a` and `b` must not change whether
  it fires.

## The signals that ship

| Signal | Confidence | Fires when |
|---|---|---|
| `parenthetical` | 0.95 | `Zaunus13 (LikoRS)` — the player wrote the pairing down |
| `deck-fingerprint` | 0.90 | the same list, ≥0.95 similar, under both handles |
| `trigram` | 0.60 | the normalized handles are ≥0.4 trigram-similar |
| `containment` | 0.55 | one handle nests inside the other, ≥4 characters |
| `temporal` | 0.30 | one stopped appearing before the other started |

Confidences are pinned by §8.6 of the master plan. Changing one is a judgement
call about the whole queue, not a tweak — raise it in an issue first.

## How they combine

Noisy-OR: `1 - product(1 - confidence)`. Each signal is independent evidence, so
two weak signals together beat one weak signal alone, and nothing short of a
certain signal ever reaches 1.

**An exclusion zeroes the candidate outright.** Two handles that appeared in the
same event are not one person — a player cannot have played themselves — and no
amount of name similarity changes that. The signals are still reported alongside
the zero, so a reviewer can see why it looked plausible.
