# ledger matches

**Purpose.** Turn an event's parsed pairings into the rows `matches` will hold.

**Inputs.** `ParsedMatch[]` from an adapter, and each handle's `IdentityId`
(`lib/results/resolve-handles.server.ts`).

**Outputs.** `NewMatch[]` for `replaceTournamentMatches`, and a `ParseIssue` per
row left out.

**Gotchas.** A match with no result, or a side with no identity, is left out
and reported — never committed as a guess, since the ledger is what every rating
replays. A bye keeps a null opponent (ADR 006). Missing game counts are 0 and a
missing round is 1, which is what a source that reports neither means.

`pnpm --filter core test -- ledger-matches`
