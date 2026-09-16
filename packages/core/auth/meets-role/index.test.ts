import { readFileSync } from "node:fs";

import type { UserRole } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { ROLE_LADDER, isUserRole, meetsRole, roleRank } from "./index";

/**
 * The same table `packages/db`'s `rls.test.ts` reads.
 *
 * The ladder exists twice and has to — a route guard cannot ask Postgres and an
 * RLS policy cannot ask TypeScript. Neither package may import the other, so
 * both are pinned to this file instead (the arrangement `normalize-handle`
 * already uses).
 */
interface LadderPair {
  readonly actual: UserRole;
  readonly required: UserRole;
  readonly meets: boolean;
}

const PAIRS = JSON.parse(
  readFileSync(new URL("../../../../fixtures/auth/role-ladder.json", import.meta.url), "utf8"),
) as readonly LadderPair[];

describe("meetsRole", () => {
  it("lets a role clear its own bar", () => {
    for (const role of ROLE_LADDER) {
      expect(meetsRole(role, role)).toBe(true);
    }
  });

  it("lets every higher role clear every lower bar", () => {
    // The ladder property, asserted over the whole ladder rather than at the
    // two or three pairs someone happened to think of.
    ROLE_LADDER.forEach((required, bar) => {
      ROLE_LADDER.forEach((actual, rung) => {
        expect(meetsRole(actual, required)).toBe(rung >= bar);
      });
    });
  });

  it("does not let a writer act as an organizer", () => {
    expect(meetsRole("writer", "organizer")).toBe(false);
    expect(meetsRole("organizer", "admin")).toBe(false);
    expect(meetsRole("reader", "writer")).toBe(false);
  });

  it("lets an admin do anything", () => {
    for (const required of ROLE_LADDER) {
      expect(meetsRole("admin", required)).toBe(true);
    }
  });

  it("agrees with the table the database is held to", () => {
    expect(PAIRS).toHaveLength(ROLE_LADDER.length ** 2);

    for (const pair of PAIRS) {
      expect(meetsRole(pair.actual, pair.required)).toBe(pair.meets);
    }
  });

  it("ranks the ladder in order, with no ties", () => {
    const ranks = ROLE_LADDER.map(roleRank);
    expect(ranks).toStrictEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(ROLE_LADDER.length);
  });
});

describe("isUserRole", () => {
  it("accepts every role on the ladder", () => {
    for (const role of ROLE_LADDER) expect(isUserRole(role)).toBe(true);
  });

  it("rejects anything else", () => {
    // What arrives from a query string, a stale cookie, or a typo.
    expect(isUserRole("superadmin")).toBe(false);
    expect(isUserRole("Admin")).toBe(false);
    expect(isUserRole("")).toBe(false);
    expect(isUserRole(null)).toBe(false);
    expect(isUserRole(3)).toBe(false);
    // Inherited from Object.prototype, not a role.
    expect(isUserRole("constructor")).toBe(false);
  });

  it("covers the contract's vocabulary exactly", () => {
    const fromContract: readonly UserRole[] = ["reader", "writer", "organizer", "admin"];
    expect([...ROLE_LADDER]).toStrictEqual([...fromContract]);
  });
});
