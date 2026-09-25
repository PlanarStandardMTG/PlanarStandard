import { describe, expect, it } from "vitest";

import { describeFetchFailure } from "./fetch-failure";

describe("lib/fetch-failure", () => {
  it("does not echo a body that failed to parse", async () => {
    const cause = await new Response("<html>Jane Doe, jane@example.com</html>")
      .json()
      .catch((error: unknown) => error);

    expect(describeFetchFailure(cause)).toBe("response was not JSON");
  });

  it("names a timeout", () => {
    expect(describeFetchFailure(new DOMException("aborted", "TimeoutError"))).toBe("timed out");
  });

  it("names a network failure without its detail", () => {
    expect(describeFetchFailure(new TypeError("fetch failed"))).toBe("fetch failed");
  });

  it("falls back to the error's name, never its message", () => {
    expect(describeFetchFailure(new RangeError("secret detail"))).toBe("RangeError");
    expect(describeFetchFailure("secret detail")).toBe("unknown error");
  });
});
