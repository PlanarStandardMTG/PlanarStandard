# parse-decklist

**Purpose.** Parse a whole decklist document into a `ParsedDeck`.

**Inputs.** The document as text — BOM, CRLF and all.

**Outputs.** `ParsedDeck`: every line that tokenized, each tagged with its board
and 1-based source line number, plus every line that did not as a
`DeckParseIssue`.

**Gotchas.** **Never drops a line.** Anything that fails to tokenize is kept as
an issue carrying the raw text verbatim, so a submitter can be shown exactly
what the parser choked on rather than silently receiving a 58-card deck.

Never throws, including on empty input.

Composes `detect-board` and `tokenize-line`; the blank-line-versus-header rule
lives in `detect-board`, not here.

`countBoard` counts quantities, not lines — a real 60-card maindeck is about 22
lines.

`pnpm --filter core test -- parse-decklist`
