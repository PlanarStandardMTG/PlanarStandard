import { describe, expect, it } from "vitest";

import { strayCredentialTarget } from "./stray-credential";

const at = (href: string) => strayCredentialTarget(new URL(href, "https://planarstandard.test"));

describe("strayCredentialTarget", () => {
  it("leaves an ordinary page view alone", () => {
    expect(at("/")).toBeNull();
    expect(at("/events?season=2")).toBeNull();
    expect(at("/community/some-post")).toBeNull();
  });

  it("rescues a code dropped on the site root by a default email template", () => {
    // What Supabase's own verify endpoint does: it redirects to the project's
    // Site URL with the credential in the query string, and there is nothing at
    // the root to spend it.
    expect(at("/?code=abc123")).toBe("/auth/confirm?next=%2Fprofile&code=abc123");
  });

  it("rescues a token hash and keeps the type it needs to be verified with", () => {
    expect(at("/?token_hash=deadbeef&type=magiclink")).toBe(
      "/auth/confirm?next=%2Fprofile&token_hash=deadbeef&type=magiclink",
    );
  });

  it("brings the visitor back to the page the credential landed on", () => {
    expect(at("/events?code=abc123")).toBe("/auth/confirm?next=%2Fevents&code=abc123");
  });

  it("keeps the rest of the query string, minus the credential", () => {
    expect(at("/events?season=2&code=abc123")).toBe(
      "/auth/confirm?next=%2Fevents%3Fseason%3D2&code=abc123",
    );
  });

  it("prefers an explicit next over the page it landed on", () => {
    expect(at("/?code=abc123&next=%2Fdashboard")).toBe(
      "/auth/confirm?next=%2Fdashboard&code=abc123",
    );
  });

  it("refuses an off-site next, as every other redirect here does", () => {
    // The credential arrives from an email, so the whole URL is attacker-shaped:
    // a crafted link must not be able to aim the redirect off the origin.
    expect(at("/?code=abc123&next=https%3A%2F%2Fevil.example")).toBe(
      "/auth/confirm?next=%2Fprofile&code=abc123",
    );
    expect(at("/?code=abc123&next=%2F%2Fevil.example")).toBe(
      "/auth/confirm?next=%2Fprofile&code=abc123",
    );
  });

  it("does not touch a request already at a handler that understands it", () => {
    // `/auth/confirm` and `/auth/callback` are the handlers. Redirecting these
    // back to themselves would be a loop.
    expect(at("/auth/confirm?code=abc123")).toBeNull();
    expect(at("/auth/callback?code=abc123")).toBeNull();
    expect(at("/auth/confirm?token_hash=deadbeef&type=signup")).toBeNull();
  });

  it("ignores an empty credential", () => {
    expect(at("/?code=")).toBeNull();
    expect(at("/?token_hash=&type=")).toBeNull();
  });

  it("ignores a token hash with no type, which cannot be verified", () => {
    expect(at("/?token_hash=deadbeef")).toBeNull();
  });
});
