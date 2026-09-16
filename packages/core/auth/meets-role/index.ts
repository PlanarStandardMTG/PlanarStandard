import type { UserRole } from "@ps/contracts";

/**
 * Whether one role clears the bar another one sets (E16.5).
 *
 * The four roles are a ladder, not a set of independent permissions: an admin
 * can do anything an organizer can, an organizer anything a writer can. That is
 * a decision and not an observation — see the README for the day it stops being
 * true and what to do then.
 */
export const ROLE_LADDER = ["reader", "writer", "organizer", "admin"] as const;

const RANK: Readonly<Record<UserRole, number>> = {
  reader: 0,
  writer: 1,
  organizer: 2,
  admin: 3,
};

/** Where a role sits on the ladder. Higher clears more. */
export function roleRank(role: UserRole): number {
  return RANK[role];
}

export function meetsRole(actual: UserRole, required: UserRole): boolean {
  return RANK[actual] >= RANK[required];
}

/** Narrows an untrusted string — a query parameter, a column read back. */
export function isUserRole(value: unknown): value is UserRole {
  // `hasOwn` and not `in`: `in` walks the prototype chain, so `"constructor"`
  // and `"toString"` would both answer yes and then index to undefined.
  return typeof value === "string" && Object.hasOwn(RANK, value);
}
