/** One page of a list, and where it sits among the rest. */
export interface Page<T> {
  readonly items: readonly T[];
  /** 1-based, clamped into range, so a stale `?page=9` shows the last page rather than nothing. */
  readonly page: number;
  readonly pages: number;
}

/** `raw` is a search param as Next hands it over: absent, repeated, or anything at all. */
export function pageOf<T>(
  items: readonly T[],
  raw: string | string[] | undefined,
  size: number,
): Page<T> {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const asked = Number.parseInt(typeof raw === "string" ? raw : "", 10);
  const page = Number.isNaN(asked) ? 1 : Math.min(Math.max(asked, 1), pages);
  return { items: items.slice((page - 1) * size, page * size), page, pages };
}
