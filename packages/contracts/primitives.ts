// Scalars the eight domain modules of §7 share. Not a domain module itself — it exists
// so that `IsoDate` has one definition instead of four, and so the module that owns a
// concept doesn't also have to own every scalar its neighbours happen to need.

/**
 * A `YYYY-MM-DD` calendar date, for the `date` columns. A string rather than a `Date`
 * because core is pure and deterministic: a `Date` would put a timezone between the
 * ledger and replay's same-date tiebreak (E8.4).
 */
export type IsoDate = string;

/** An ISO 8601 instant, for the `timestamptz` columns. */
export type IsoDateTime = string;

/** Anything that survives a round trip through a `jsonb` column. */
export type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };
