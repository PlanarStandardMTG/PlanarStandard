# `repos/events`

Reads and writes over `external_events` and `external_event_syncs` (E23.6).

**Inputs.** A `SupabaseClient` supplied by the caller. The three reads take the
public client; `claimSyncWindow`, `replaceEvents` and `recordSyncResult` take the
**service-role** client — the sync ledger has RLS on and no policy at all.

**Outputs.** `ExternalEvent` and `EventSyncState` from `@ps/contracts`. The
snake_case row shape does not leave `rows.ts`.

**Gotchas.**

- `claimSyncWindow` is one conditional update, not a read then a write. That is
  the whole point: two simultaneous page views must produce one fetch, because
  the budget is 500 requests a month. It stamps `last_attempted_at` **before**
  the fetch, so a failing source costs one request per window rather than one per
  visitor.
- `replaceEvents` supersedes wholesale — upsert, then delete everything not in
  the payload. An event the organiser deleted has to leave the cache, and the
  payload is the whole truth about what the calendar contains. Upserting before
  pruning means a concurrent reader sees the old calendar or the new one, never
  a gap.
- `listAllCachedEvents` is the read behind the pages; `listCachedEvents` is the
  read behind a refresh. The difference is the budget: a fetch has to know whose
  calendar it is spending a request on, and a reader asking what is on this
  weekend does not care which platform is hosting it.
- This module never touches `tournaments`. The cache and the ledger are separate
  tables for a reason the migration spells out.

Policy: [`docs/modules/events.md`](../../../docs/modules/events.md).
