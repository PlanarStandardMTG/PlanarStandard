import { afterEach, describe, expect, it } from "vitest";

import { originOf } from "./origin";

const request = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { headers });

afterEach(() => {
  delete process.env["NEXT_PUBLIC_SITE_URL"];
});

describe("originOf", () => {
  it("uses the configured site URL wherever the request landed", () => {
    process.env["NEXT_PUBLIC_SITE_URL"] = "https://planarstandard.vercel.app";

    // A preview deployment. Without the override every emailed link would point
    // back at this hostname, which the allow-list rejects.
    const preview = request("https://internal.vercel.app/auth/magic-link", {
      "x-forwarded-host": "planarstandard-git-branch-x.vercel.app",
      "x-forwarded-proto": "https",
    });

    expect(originOf(preview)).toBe("https://planarstandard.vercel.app");
  });

  it("does not leave a trailing slash for the caller to double up", () => {
    process.env["NEXT_PUBLIC_SITE_URL"] = "https://planarstandard.vercel.app/";
    expect(originOf(request("https://example.test/"))).toBe("https://planarstandard.vercel.app");
  });

  it("ignores the override when it is set to nothing", () => {
    // Vercel exposes an unset project variable as the empty string rather than
    // leaving it undefined, so this is the shape a forgotten value arrives in.
    process.env["NEXT_PUBLIC_SITE_URL"] = "";
    expect(originOf(request("http://localhost:3000/auth/magic-link"))).toBe(
      "http://localhost:3000",
    );
  });

  it("falls back to the forwarded host behind a proxy", () => {
    expect(
      originOf(
        request("http://10.0.0.1/auth/magic-link", {
          "x-forwarded-host": "planarstandard.vercel.app",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://planarstandard.vercel.app");
  });

  it("assumes https when a proxy forwards a host without a protocol", () => {
    expect(
      originOf(request("http://10.0.0.1/", { "x-forwarded-host": "planarstandard.vercel.app" })),
    ).toBe("https://planarstandard.vercel.app");
  });

  it("uses the request itself when nothing is in front of it", () => {
    expect(originOf(request("http://localhost:3000/auth/magic-link"))).toBe(
      "http://localhost:3000",
    );
  });
});
