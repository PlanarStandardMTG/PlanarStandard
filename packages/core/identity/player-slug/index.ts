/**
 * A new player's URL key, from the handle they were first seen under.
 *
 * `attempt` is for the caller's retry when `players.slug` is taken — by a merged
 * or hidden player, or a handle that differs only in characters a slug drops.
 */
export function playerSlug(handle: string, attempt = 1): string {
  const base =
    handle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "player";
  return attempt <= 1 ? base : `${base}-${attempt}`;
}
