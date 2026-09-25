import type { UserRole } from "@ps/contracts";

/**
 * The accounts `packages/db/seed/0001_profiles.sql` creates, one per rung and
 * then some, for the header's account switcher.
 *
 * Mirrors the seed by hand: the seed is SQL and this is not, and six rows are
 * cheaper to keep in step than a loader would be to write.
 */
export const DEV_ACCOUNTS: readonly {
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
}[] = [
  { email: "reader@planarstandard.test", name: "Rook Pellwater", role: "reader" },
  { email: "wrenfield@planarstandard.test", name: "Wren Ashfield", role: "writer" },
  { email: "quillfeather@planarstandard.test", name: "Ines Quillfeather", role: "writer" },
  { email: "brackwater@planarstandard.test", name: "Odis Brackwater", role: "writer" },
  { email: "tallowmere@planarstandard.test", name: "Tam Tallowmere", role: "organizer" },
  { email: "newsdesk@planarstandard.test", name: "Planar Standard", role: "admin" },
];

export const DEV_PASSWORD = "seed-password-not-a-secret";

/**
 * `next dev` only. Next inlines `NODE_ENV` at build time, so in a production
 * bundle this is `false` and the switcher is dead code.
 */
export function devAccountSwitcherEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}
