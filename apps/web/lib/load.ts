/**
 * Turns a throwing data call into a value the page can render either way.
 *
 * Every data-backed page needs the same three branches — data, nothing, or the
 * database is unreachable — and an uncaught throw in a server component takes
 * the whole route down. This keeps the failure inside the section that failed.
 */
export type Loaded<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

export async function load<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause);
    console.error("data load failed:", error);
    return { ok: false, error };
  }
}
