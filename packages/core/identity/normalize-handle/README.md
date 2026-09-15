# normalize-handle

**Purpose.** The matching key for a platform handle.

**Inputs.** A handle as a source spelled it. **Outputs.** Lowercase alphanumerics.

**Gotchas.** Must match the generated column on `player_identities` **exactly**:

```sql
lower(regexp_replace(handle, '[^a-zA-Z0-9]', '', 'g'))
```

A parity test pins a table of inputs against what Postgres produces. If the two
drift, every identity lookup silently misses.

Postgres strips first and lowercases second, and so does this. The order only
matters outside ASCII — `İ` lowercases to two code points in JavaScript and only
one survives the strip — but keeping it identical keeps the implementations
identical.

`pnpm --filter core test -- normalize-handle`
