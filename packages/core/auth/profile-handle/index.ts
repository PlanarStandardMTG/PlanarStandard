/**
 * What a person may call themselves in a URL (E16.4).
 *
 * `profiles.handle` is unique and is destined for `/@handle`-shaped links, so it
 * is a slug rather than a display name: the display name is where someone gets
 * to use punctuation, emoji, and their own alphabet. Distinct from
 * `identity/normalize-handle`, which folds a *platform* handle off a tournament
 * export so two spellings of the same player meet — that one describes what
 * somebody else wrote, this one constrains what we accept.
 */

export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 30;

/** Handles that would collide with a route, or imply an authority nobody granted. */
const RESERVED = new Set([
  "admin",
  "administrator",
  "api",
  "articles",
  "auth",
  "cards",
  "dashboard",
  "decks",
  "events",
  "leaderboard",
  "login",
  "logout",
  "meta",
  "moderator",
  "news",
  "official",
  "planarstandard",
  "players",
  "profile",
  "rules",
  "settings",
  "staff",
  "support",
  "tournaments",
  "unauthorized",
]);

/**
 * Why a handle was refused. A code and not a sentence: core holds no copy, and
 * the site needs to say this in its own voice, in one place, next to the form.
 */
export type HandleProblem = "too-short" | "too-long" | "charset" | "reserved";

export type HandleCheck =
  | { readonly ok: true; readonly handle: string }
  | { readonly ok: false; readonly problem: HandleProblem };

/**
 * Validate a handle someone typed, and return the form to store.
 *
 * Lowercased before the uniqueness check rather than after: `Wren` and `wren`
 * are the same person's claim on the same URL, and a database unique index on
 * the raw text would happily hold both.
 */
export function checkProfileHandle(raw: string): HandleCheck {
  const handle = raw.trim().toLowerCase();

  if (handle.length < HANDLE_MIN_LENGTH) return { ok: false, problem: "too-short" };
  if (handle.length > HANDLE_MAX_LENGTH) return { ok: false, problem: "too-long" };
  if (!/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/.test(handle)) {
    return { ok: false, problem: "charset" };
  }
  if (RESERVED.has(handle)) return { ok: false, problem: "reserved" };

  return { ok: true, handle };
}
