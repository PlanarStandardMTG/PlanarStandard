# result choice

**Purpose.** The results a player or organizer can pick for a pairing, and the pick as the pairing stores it (E26.20).

**Inputs.** A choice's code (`2-1-0`, from the picker's side), which side they are, and whether the round is in the top cut.

**Outputs.** `resultChoices` — the list to show. `gamesFromChoice` — `RunGames` from player 1's side, or null.

**Gotchas.** Best of three. An intentional draw with no games played is 0–0–3 (MTR §2.5); the
top cut offers no draws at all (§2.4), and the database refuses one too.

`pnpm --filter core test -- runs/result-choice`
