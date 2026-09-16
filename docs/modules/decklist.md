# The decklist grammar

What `core/decklist` accepts, and what it does not. Every rule below exists
because a real file in `fixtures/decklists/` does it — the corpus is drawn from
417 real decklists across 35 events.

Modules: `tokenize-line`, `detect-board`, `normalize-name`, `parse-decklist`,
`parse-filename` (E3).

---

## Card lines

```
<quantity>[x] <card name>[ (<set>) <collector>][ *F*]
```

| Part      | Rule                                                                             |
| --------- | -------------------------------------------------------------------------------- |
| quantity  | One or more digits, optionally followed by `x` or `X`. Zero is rejected.         |
| card name | Everything up to a trailing printing or foil marker. Kept verbatim.              |
| set       | Two to six letters or digits in parentheses. **Optional.**                       |
| collector | Any non-space run, immediately after the set. **Optional**, and always a string. |
| foil      | A trailing ` *F*`.                                                               |

Accepted, all from real lines:

```
4 Bloomvine Regent / Claim Territory (TDM) 136
2 Feed the Swarm (FDN) 712 *F*
4 Llanowar Elves (fdn) 227
1 Essence Scatter (PLST) M19-54
1 Fumigate (PKLD) 15s *F*
4 Day of Judgment (PZEN) 9★ *F*
1 Giant Growth (WC99) ml233
2 Soul-Guide Lantern
4x Stock Up (DFT) 67
```

Three things that look like edge cases and are not:

- **No printing at all.** 321 distinct lines in the corpus are a bare
  `<qty> <name>`. The set and collector fields are omitted, not emptied.
- **Collector numbers are not numbers.** `11p`, `72s`, `KLD-5`, `M19-54`,
  `ml233`, `9★`. Parsed as a number, every one of them is lost.
- **The printed set is frequently outside the legal pool.** `(STA)`, `(GRN)`,
  `(M19)`, `(PLST)`, promos. This is correct and expected: legality is decided on
  the oracle card, and any printing may be played (ADR 007). The set code is kept
  only as provenance.

## Boards

A board header on its own line switches everything after it:

```
SIDEBOARD:   Sideboard   Side Board   SB:   Deck   Maindeck   Main Deck
Commander    Command Zone
```

Case-insensitive, with an optional trailing colon and an optional leading `//`.

An `SB:` prefix on a card line switches that line alone:

```
SB: 2 Negate (FDN) 710
```

**Blank lines are structural only in a file with no header anywhere.** That is
the MTGO export convention: maindeck, blank line, sideboard. In a file that names
its boards, a blank line is spacing — which matters, because plenty of real lists
have a blank line between colour groups in the maindeck, and treating it as a
boundary would silently move half the deck to the sideboard.

## Names

Names are stored as written and normalized only for lookup. Normalization is
NFKC, case-folded, punctuation-stripped, with faces joined by `//`:

| Written                                 | Normalized                             |
| --------------------------------------- | -------------------------------------- |
| `Ride's End`                            | `rides end`                            |
| `Ugin, Eye of the Storms`               | `ugin eye of the storms`               |
| `Sanar, Unfinished Genius / Wild Idea`  | `sanar unfinished genius // wild idea` |
| `Sanar, Unfinished Genius // Wild Idea` | `sanar unfinished genius // wild idea` |

Decklist exports write `/` between faces where Scryfall writes `//`; both
reach the same key. Each face is also keyed on its own, because a list may write
only the front face.

## Filenames

```
Player (alias)｜Deck｜Archetype｜W-L-D｜GW-GL
```

The separator is a **fullwidth** vertical line `｜` (U+FF5C) — ASCII `|` is
illegal in a Windows filename. Files also arrive with every separator rewritten
to `_`, which is accepted.

Records are found by shape rather than position: three parts is the match record,
two is the game record. So `100beep｜Mono Red｜3-0-0｜6-2`, which has no
archetype segment, still parses correctly.

The trailing `(alias)` is split out into its own field. These are explicit
identity pairings already present in the data — `Zaunus13 (LikoRS)`,
`divnyi (Mika)`, `C0d3 (c0d33)` — and `core/identity/signals/parenthetical`
(E9.2) reads them directly.

---

## Known unsupported

Deliberate, with the reason:

| Form                                                        | Why not                                                                      |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A handle containing `_` in an `_`-separated filename        | Ambiguous with the separator. Prefer the fullwidth form.                     |
| Quantity after the name (`Lightning Bolt x4`)               | Not present in any real file.                                                |
| Deck names or categories as inline headers (`// Creatures`) | Read as comments; category grouping carries no information the metrics need. |
| Multiple printings on one line                              | Not present in any real file.                                                |
| `(SET)` with no collector number after it                   | Kept as part of the card name rather than guessed at.                        |

A new form is **a fixture plus a branch** — see `fixtures/README.md`. That is the
smallest useful contribution in this repo and it is meant to be.
