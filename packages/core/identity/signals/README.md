# signals

One file per kind of evidence that two handles are one person.

**See [`../README.md`](../README.md) for the authoring guide** — the file
template, the rules a signal follows, and how the confidences combine.

| Signal | Confidence |
|---|---|
| `parenthetical` | 0.95 |
| `deck-fingerprint` | 0.90 |
| `trigram` | 0.60 |
| `containment` | 0.55 |
| `temporal` | 0.30 |

`types.ts` holds the shared `HandleObservation`, `SignalContext` and
`SignalScorer` types. Everything else in this directory is one signal.
