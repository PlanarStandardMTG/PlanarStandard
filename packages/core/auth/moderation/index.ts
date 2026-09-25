import type { UserRole } from "@ps/contracts";

import { meetsRole } from "../meets-role/index";

/**
 * Whether an admin may change a member's role or ban them (E14.7).
 *
 * Never yourself: the one making the change always survives it, which is what
 * keeps the site from ending up with no admin. Never a tombstone: there is
 * nobody left to act on. `profiles_admin_update` says the same in SQL.
 */
export type ModerationProblem = "not-admin" | "self" | "erased";

export type ModerationCheck =
  { readonly ok: true } | { readonly ok: false; readonly problem: ModerationProblem };

export function checkModeration(
  actor: { readonly id: string; readonly role: UserRole },
  target: { readonly id: string; readonly deletedAt: string | null },
): ModerationCheck {
  if (!meetsRole(actor.role, "admin")) return { ok: false, problem: "not-admin" };
  if (actor.id === target.id) return { ok: false, problem: "self" };
  if (target.deletedAt !== null) return { ok: false, problem: "erased" };
  return { ok: true };
}
