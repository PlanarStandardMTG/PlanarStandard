import { describe, expect, it } from "vitest";

import { DEFAULT_NEXT, loginHref, safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("keeps a path on this site", () => {
    expect(safeNextPath("/dashboard/format")).toBe("/dashboard/format");
    expect(safeNextPath("/events?source=melee#top")).toBe("/events?source=melee#top");
  });

  it("falls back when there is nothing to go back to", () => {
    expect(safeNextPath(null)).toBe(DEFAULT_NEXT);
    expect(safeNextPath(undefined)).toBe(DEFAULT_NEXT);
    expect(safeNextPath("")).toBe(DEFAULT_NEXT);
  });

  it("refuses an absolute URL", () => {
    expect(safeNextPath("https://evil.example/login")).toBe(DEFAULT_NEXT);
    expect(safeNextPath("http://evil.example")).toBe(DEFAULT_NEXT);
    expect(safeNextPath("javascript:alert(1)")).toBe(DEFAULT_NEXT);
  });

  it("refuses a protocol-relative path", () => {
    // The whole reason this function exists: both of these start with a slash
    // and both of them leave the site.
    expect(safeNextPath("//evil.example")).toBe(DEFAULT_NEXT);
    expect(safeNextPath("/\\evil.example")).toBe(DEFAULT_NEXT);
  });

  it("refuses a value that could forge a second header", () => {
    expect(safeNextPath("/events\r\nSet-Cookie: role=admin")).toBe(DEFAULT_NEXT);
  });

  it("takes a caller's own fallback", () => {
    expect(safeNextPath(null, "/")).toBe("/");
  });

  it("escapes the destination it hands to the login page", () => {
    expect(loginHref("/dashboard?tab=bans")).toBe("/login?next=%2Fdashboard%3Ftab%3Dbans");
  });
});
