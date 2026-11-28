# swiss capacity

**Purpose.** The most Swiss rounds a field can play without a rematch, so a start above it is refused.

**Inputs.** The number of players checked in.

**Outputs.** A round count: one less than the field when it is even, the field itself when odd.

**Gotchas.** A ceiling, not a guarantee. Pairing by points can strand a pairing a round or two
earlier (six players can be left as two triangles after three rounds); the organizer then ends
the Swiss early (`run-state`'s `canEndSwiss`).

`pnpm --filter core test -- runs/swiss-capacity`
