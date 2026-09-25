import { describe, expect, it } from "vitest";

import { authorizeJob } from "./authorize.server";

describe("lib/jobs/authorize", () => {
  it("accepts the bearer secret, exactly", () => {
    expect(authorizeJob("Bearer s3cret", "s3cret")).toBe("ok");
  });

  it("refuses a wrong, partial or missing header", () => {
    expect(authorizeJob("Bearer nope", "s3cret")).toBe("unauthorized");
    expect(authorizeJob("s3cret", "s3cret")).toBe("unauthorized");
    expect(authorizeJob("Bearer s3cret ", "s3cret")).toBe("unauthorized");
    expect(authorizeJob(null, "s3cret")).toBe("unauthorized");
  });

  it("refuses everything when no secret is configured, even an empty bearer", () => {
    expect(authorizeJob("Bearer ", "")).toBe("not-configured");
    expect(authorizeJob("Bearer undefined", undefined)).toBe("not-configured");
  });
});
