/**
 * Group-and-fold helpers. Every stats builder reduces a flat list of rows into
 * per-key totals, and doing it by hand each time is where off-by-one denominators
 * come from.
 *
 * Maps, not records: keys here are ids (`OracleId`, `ArchetypeId`) that keep their
 * brand, and a record would stringify them.
 */

export function groupBy<T, K>(items: Iterable<T>, keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [item]);
    else group.push(item);
  }
  return groups;
}

export function countBy<T, K>(items: Iterable<T>, keyOf: (item: T) => K): Map<K, number> {
  const counts = new Map<K, number>();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Sums `valueOf` per key in one pass. An absent key sums to nothing, never to zero. */
export function sumBy<T, K>(
  items: Iterable<T>,
  keyOf: (item: T) => K,
  valueOf: (item: T) => number,
): Map<K, number> {
  const sums = new Map<K, number>();
  for (const item of items) {
    const key = keyOf(item);
    sums.set(key, (sums.get(key) ?? 0) + valueOf(item));
  }
  return sums;
}

export function sum<T>(items: Iterable<T>, valueOf: (item: T) => number): number {
  let total = 0;
  for (const item of items) total += valueOf(item);
  return total;
}

/**
 * The general case: fold each group into an accumulator.
 *
 * `seed` is called per key rather than shared, so a mutable accumulator cannot
 * leak between groups — the bug this signature exists to prevent.
 */
export function aggregateBy<T, K, A>(
  items: Iterable<T>,
  keyOf: (item: T) => K,
  seed: (key: K) => A,
  fold: (accumulator: A, item: T) => A,
): Map<K, A> {
  const out = new Map<K, A>();
  for (const item of items) {
    const key = keyOf(item);
    const current = out.has(key) ? (out.get(key) as A) : seed(key);
    out.set(key, fold(current, item));
  }
  return out;
}

/** Shares of a whole, per key. Returns an empty map when the total is zero — a
 * share of nothing is not 0%, it is undefined, and charting it as 0% is a lie. */
export function shareOf<K>(counts: ReadonlyMap<K, number>): Map<K, number> {
  let total = 0;
  for (const value of counts.values()) total += value;
  if (total === 0) return new Map();
  const shares = new Map<K, number>();
  for (const [key, value] of counts) shares.set(key, value / total);
  return shares;
}
