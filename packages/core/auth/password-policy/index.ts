/**
 * What we require of a password (E16.9).
 *
 * Supabase enforces the minimum itself — `minimum_password_length` in
 * `supabase.config.toml` is the authority, and this module mirrors it. The point
 * of mirroring is that somebody gets told what is wrong before a round trip,
 * and in the same words every time; the point of the comment is that when one
 * changes the other has to.
 */

export const PASSWORD_MIN_LENGTH = 8;

/**
 * bcrypt hashes the first 72 **bytes** and silently ignores the rest, so a
 * longer password is not a stronger one — and two passphrases sharing a long
 * prefix would be the same password. Refused rather than truncated: truncating
 * means the password someone typed is not the password they have.
 */
export const PASSWORD_MAX_BYTES = 72;

export type PasswordProblem = "too-short" | "too-long" | "blank";

/**
 * How many bytes this string is as UTF-8.
 *
 * Counted rather than measured with `TextEncoder`, which is a host global that
 * `core` has no types for — this package imports nothing, and that is the
 * property that lets it be tested with no environment at all. Iterating with
 * `for…of` walks code points, so a surrogate pair counts once, at four bytes.
 */
export function utf8ByteLength(value: string): number {
  let bytes = 0;

  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint < 0x80) bytes += 1;
    else if (codePoint < 0x800) bytes += 2;
    else if (codePoint < 0x10000) bytes += 3;
    else bytes += 4;
  }

  return bytes;
}

export type PasswordCheck =
  { readonly ok: true } | { readonly ok: false; readonly problem: PasswordProblem };

export function checkPassword(raw: string): PasswordCheck {
  if (raw.trim() === "") return { ok: false, problem: "blank" };
  if (raw.length < PASSWORD_MIN_LENGTH) return { ok: false, problem: "too-short" };

  // Length in bytes, not characters: an emoji is four of bcrypt's 72 and one of
  // `String.length`'s.
  if (utf8ByteLength(raw) > PASSWORD_MAX_BYTES) return { ok: false, problem: "too-long" };

  return { ok: true };
}
