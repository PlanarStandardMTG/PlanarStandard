import { describe, expect, it } from "vitest";

import { canReview, isReviewDecision, reviewedStatus, submissionStatus } from "./index";

describe("submissionStatus", () => {
  it("holds a reader's post for review", () => {
    expect(submissionStatus("reader")).toBe("review");
  });

  it.each(["writer", "organizer", "admin"] as const)("publishes a %s's post directly", (role) => {
    expect(submissionStatus(role)).toBe("published");
  });
});

describe("canReview", () => {
  it("is writer and up", () => {
    expect(canReview("reader")).toBe(false);
    expect(canReview("writer")).toBe(true);
    expect(canReview("admin")).toBe(true);
  });
});

describe("reviewedStatus", () => {
  it("publishes an approval and returns a rejection to draft", () => {
    expect(reviewedStatus("approve")).toBe("published");
    expect(reviewedStatus("reject")).toBe("draft");
  });
});

describe("isReviewDecision", () => {
  it("narrows form input", () => {
    expect(isReviewDecision("approve")).toBe(true);
    expect(isReviewDecision("publish")).toBe(false);
    expect(isReviewDecision(null)).toBe(false);
  });
});
