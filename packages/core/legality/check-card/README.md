# check-card

**Purpose.** One card against the pool, the banlist and the exceptions.

**Inputs.** The card (name, oracle id, boards), `FormatRules`, `CardIndex`.
**Outputs.** A `CardIssue`, or `null` when the card is fine.

**Gotchas.** **ADR 007 lives here.** A card is legal if its oracle card has _any_
printing in a legal set, and any printing may then be played. The printed set on
the decklist line is never consulted: `Llanowar Elves (M19)` is legal because the
oracle card is in FDN, and `Mistrise Village (PTDM)` is legal because the oracle
card is in TDM.

Precedence, and it matters:

1. a **ban** beats everything, including an exception
2. a **`legal_exception`** beats absence from the pool
3. otherwise the oracle card must have a printing in a legal set

An unresolved name is reported as an issue rather than waved through — legality
unproven is not legality.

`pnpm --filter core test -- legality`
