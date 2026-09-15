# fixtures/cards

Small `CardDataset` fixtures, shaped exactly like the generated `data/cards/`
artifact (§14.1), so legality and metrics can be tested with no dataset build and
no network.

`azorius-control-dataset.json` carries every card in
`fixtures/decklists/real-deck-azorius-control.txt`, with each card's **legal**
set rather than its printed one. That is ADR 007 in a file: the deck plays
`Mistrise Village (PTDM) 261p`, a promo printing outside the six-set pool, and it
is legal because the oracle card has a TDM printing.

Mana values, colours and type lines are placeholders. Nothing here should be used
to assert a metric — the metric golden test (E22.8) needs the community
spreadsheet, not this.
