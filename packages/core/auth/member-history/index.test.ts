import { describe, expect, it } from "vitest";

import { canRemoveContent, canViewHistory } from "./index";

const as = (role: "reader" | "writer" | "organizer" | "admin", banned = false) => ({
  role,
  bannedAt: banned ? "2026-09-01T00:00:00.000Z" : null,
});

describe("auth/member-history", () => {
  it("shows the history to writer and up, and to nobody signed out", () => {
    expect(canViewHistory(null)).toBe(false);
    expect(canViewHistory(as("reader"))).toBe(false);
    expect(canViewHistory(as("writer"))).toBe(true);
    expect(canViewHistory(as("admin"))).toBe(true);
  });

  it("leaves removal to admins", () => {
    expect(canRemoveContent(as("organizer"))).toBe(false);
    expect(canRemoveContent(as("admin"))).toBe(true);
  });

  it("takes both away from a banned member", () => {
    expect(canViewHistory(as("admin", true))).toBe(false);
    expect(canRemoveContent(as("admin", true))).toBe(false);
  });
});
