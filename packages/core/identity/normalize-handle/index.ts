/**
 * The normalized form of a platform handle.
 *
 * Must match the generated column on `player_identities` exactly:
 *
 *     lower(regexp_replace(handle, '[^a-zA-Z0-9]', '', 'g'))
 *
 * Postgres strips first and lowercases second, and this does the same. The order
 * matters for characters outside ASCII: strip-then-lower removes `Ä` entirely,
 * where lower-then-strip would too, but `İ` lowercases to two code points in
 * JavaScript and only one of them would survive. Keeping the order identical
 * keeps the two implementations identical.
 */
const NON_ALPHANUMERIC = /[^a-zA-Z0-9]/g;

export function normalizeHandle(handle: string): string {
  return handle.replace(NON_ALPHANUMERIC, "").toLowerCase();
}
