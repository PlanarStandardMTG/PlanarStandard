import { describe, expect, it } from "vitest";

import { checkModeration } from "./index";

const admin = { id: "a", role: "admin" as const };
const member = { id: "m", deletedAt: null };

describe("checkModeration", () => {
  it("lets an admin act on somebody else", () => {
    expect(checkModeration(admin, member)).toStrictEqual({ ok: true });
  });

  it("refuses an admin acting on themselves", () => {
    expect(checkModeration(admin, { id: "a", deletedAt: null })).toStrictEqual({
      ok: false,
      problem: "self",
    });
  });

  it("refuses a tombstone", () => {
    expect(
      checkModeration(admin, { id: "m", deletedAt: "2026-09-16T00:00:00.000Z" }),
    ).toStrictEqual({ ok: false, problem: "erased" });
  });

  it.each(["reader", "writer", "organizer"] as const)("refuses a %s", (role) => {
    expect(checkModeration({ id: "x", role }, member)).toStrictEqual({
      ok: false,
      problem: "not-admin",
    });
  });
});
