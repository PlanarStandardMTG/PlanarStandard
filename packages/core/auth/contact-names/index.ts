/**
 * Checks the Arena username and Discord name a member types on their profile (E26.15).
 *
 * The Arena username is what an opponent pastes into a Direct Challenge, which needs
 * the whole thing, tag included: `Brayzon#12345`. Discord names are loose enough
 * that only the length is checked.
 */

export const CONTACT_NAME_MAX_LENGTH = 64;

export type ContactNameProblem = "arena-tag" | "arena-too-long" | "discord-too-long";

export type ContactNamesCheck =
  | {
      readonly ok: true;
      readonly arenaUsername: string | null;
      readonly discordName: string | null;
    }
  | { readonly ok: false; readonly problem: ContactNameProblem };

const ARENA_USERNAME = /^\S(.*\S)?#\d{1,6}$/;

/** Trimmed, with an empty field meaning "none" rather than an error. */
export function checkContactNames(raw: {
  readonly arenaUsername: string;
  readonly discordName: string;
}): ContactNamesCheck {
  const arena = raw.arenaUsername.trim();
  const discord = raw.discordName.trim();

  if (arena.length > CONTACT_NAME_MAX_LENGTH) return { ok: false, problem: "arena-too-long" };
  if (arena !== "" && !ARENA_USERNAME.test(arena)) return { ok: false, problem: "arena-tag" };
  if (discord.length > CONTACT_NAME_MAX_LENGTH) return { ok: false, problem: "discord-too-long" };

  return {
    ok: true,
    arenaUsername: arena === "" ? null : arena,
    discordName: discord === "" ? null : discord,
  };
}
