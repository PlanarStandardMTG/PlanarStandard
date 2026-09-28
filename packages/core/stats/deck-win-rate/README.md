# deck win rate

**Purpose.** A deck's match win rate over the events it was played at (E20.45).

**Inputs.** The `WinLossDraw` record of every entry that played the deck, any version of it.

**Outputs.** `DeckWinRate` — the summed record and its `SuppressionVerdict` under
`DECK_WIN_RATE`; `compareWinRates` orders them best first for the deck browser.

**Gotchas.** A draw is a match played and not won. A withheld rate sorts last
rather than as zero, since "not enough matches" is not "lost them all".

`pnpm --filter core test -- deck-win-rate`
