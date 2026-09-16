/**
 * The header `proxy.ts` uses to tell a render which path it is for.
 *
 * Its own module, with no imports, for two reasons. The proxy runs in front of
 * the app and must not pull `next/headers` into its bundle, which is what
 * importing the reader would do. And a name shared between two files should be
 * written once: a typo in one of two string literals degrades silently, with
 * every post-login redirect still working and every one of them landing on
 * `/profile`.
 */
export const CURRENT_PATH_HEADER = "x-planar-path";
