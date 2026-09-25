# `repos/decks`

**Purpose.** Read and write `decks` and `deck_cards` (E13.16) — one deck with its
list, a player's decks, a season's public decks, and the write the import paths
use.

**Inputs.** A `SupabaseClient` supplied by the caller. The three reads take the
public client; `insertDeck` takes the **service-role** client, because neither
table has an insert policy yet (E14.2).

**Outputs.** `Deck`, `DeckWithCards` and `DeckCard` from `@ps/contracts`. The
snake_case row shape does not leave `rows.ts`.

**Gotchas.**

- **The policy decides what may be read; a listing decides what is listed.** The
  read policy admits anything not `private`, so an unlisted deck is readable —
  that is what unlisted means, and a policy that hid it would break the share
  link the state exists for. `listPublicDecksBySeason` therefore filters
  `visibility = 'public'` itself rather than leaning on RLS, and
  `listDecksByPlayer` deliberately does not: a deck someone kept out of the
  browse pages is still theirs, and their own page shows it.
- **`insertDeck` is not atomic and cannot be from here.** PostgREST has no
  transaction spanning two tables, so it writes the deck, writes the cards, and
  deletes the deck if the cards fail. A `decks` row with no `deck_cards` reads as
  an empty deck everywhere and is indistinguishable from a legitimately empty
  one, which is worse than no row. If genuine atomicity is ever needed, the
  answer is a `plpgsql` function and an RPC, not a cleverer sequence.
- **A member never deletes a deck; they hide it** (E20.31). `hidden_at` takes it out
  of `listMemberDecks` and `listDeckVersions` and off the public read policy — except
  where a tournament entry names it, since an event's record outlives the player's
  tidying. The owner can still read their hidden decks, because the data export
  (`listDecksByOwner`) must hand them over.
- A card whose name did not resolve is stored with a null `oracle_id` and the
  deck is flagged (E18.10). Dropping the line would make a 60-card deck read as
  59 and legal.
- The listings select a narrower column set: `raw_import` is the whole decklist
  and `validation` is a verdict payload, and a browse page pulling both per row
  is a query that is fine at twelve decks and not at twelve hundred. `toDeck`
  coalesces them rather than asserting, so a summary row maps without lying.
- The embedded card select carries no order of its own, so `toDeckWithCards`
  sorts: maindeck, sideboard, command zone, then by name. Sorting in the mapper
  rather than the query because PostgREST orders an embedded resource through a
  separate parameter that is silent when it goes missing.

`pnpm --filter db test -- repos/decks`
