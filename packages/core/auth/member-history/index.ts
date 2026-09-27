import type { UserRole } from "@ps/contracts";

import { meetsRole } from "../meets-role/index";

/**
 * Who may open a member's history, and who may remove what is on it (E20.42).
 *
 * Writer and up see it, and see every name on the site as a link to it. Below
 * that, and signed out, a name is plain text, so nobody learns the page exists.
 * Removing anything, or banning, is an admin's.
 */
export const HISTORY_ROLE: UserRole = "writer";

type Viewer = { readonly role: UserRole; readonly bannedAt: string | null } | null;

export function canViewHistory(viewer: Viewer): boolean {
  return viewer !== null && viewer.bannedAt === null && meetsRole(viewer.role, HISTORY_ROLE);
}

export function canRemoveContent(viewer: Viewer): boolean {
  return viewer !== null && viewer.bannedAt === null && meetsRole(viewer.role, "admin");
}
