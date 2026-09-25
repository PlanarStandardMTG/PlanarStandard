# `repos/identity`

**Purpose.** Read and write the identity tables (E13.19): the players, the handles
they played under, and the curation around them — what can never be merged, what
might want merging, and what was merged.

**Inputs.** A `SupabaseClient`. The player and handle reads take the public client
and are covered by policies that follow the player's visibility. Everything else
takes the **service-role** client: `identity_exclusions`, `merge_suggestions` and
`player_merges` have no read policy at all, so the anon client sees an empty
result and no error.

**Outputs.** `Player`, `IdentityRef`, `Exclusion`, `MergeSuggestion` and
`PlayerMerge` from `@ps/contracts`. The snake_case row shape does not leave
`rows.ts`.

**Gotchas.**

- **`findIdentityByNormalizedHandle` takes the normalized handle, not the raw
  one.** `normalized` is a generated column and this package may not import
  `core/identity/normalize-handle` to produce it — the dependency rule points the
  other way. The two are pinned to `fixtures/identity/normalized-handles.json`
  and `generated-columns.test.ts` asserts they agree.
- **`listIdentitiesByNormalized` is not scoped to a platform.** It is the batch
  read an import resolves a whole event from, and a handle's other-platform
  matches are part of the answer (E18.20); `core/identity/resolve-handles` picks.
- **A miss is a normal answer.** An unseen handle is a new person until somebody
  merges it (Part IX answer 6), so the caller's next move is
  `createPlayerWithIdentity` rather than an error.
- **`repointPlayerRows` does not touch `matches`,** and never will: the ledger
  points at identities, which is the whole of ADR 003 — nothing in history
  changes when two handles turn out to be one person. It does not touch the
  rating tables either, for a different reason: those are derived, and a merge is
  followed by a recompute rather than by moving a rating from one player to
  another (ADR 004).
- **`markPlayerMerged` does not delete the loser.** The row stays so an old link
  and an old `rating_event` both still resolve; the leaderboard reads
  `merged_into is null` and so the merged row is absent rather than deleted.
- **`recordExclusions` is additive and cannot remove one.** An exclusion is a fact
  that stays true — two handles in the same event were two people then and still
  are — so re-running `co-appearance-exclusions` over a re-imported event must not
  be able to take one back.
- **`replaceMergeSuggestions` clears only what is still pending,** and skips any
  pair that already has a row. A dismissal is a human's answer and a later run
  must not resurrect the pair; a merged pair must not come back as a suggestion to
  merge it again.
- Both pair tables want their pairs **ordered** (`identity_a < identity_b`,
  `player_a < player_b`). That is a check constraint, and without it the same two
  would appear twice, once each way round.

`pnpm --filter db test -- repos/identity`
