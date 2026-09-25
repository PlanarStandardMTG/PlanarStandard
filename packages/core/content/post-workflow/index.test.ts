import { describe, expect, it } from "vitest";

import {
  canEditOwnPost,
  canReview,
  canWriteKind,
  isReviewDecision,
  reviewedStatus,
  savedStatus,
  submissionStatus,
} from "./index";

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

describe("savedStatus", () => {
  it("submits where submissionStatus says", () => {
    expect(savedStatus(null, "submit", "reader")).toBe("review");
    expect(savedStatus("draft", "submit", "writer")).toBe("published");
  });

  it("keeps a writer's live post live when they save a correction", () => {
    expect(savedStatus("published", "save", "writer")).toBe("published");
  });

  it("returns anything else to draft, including a post waiting for review", () => {
    expect(savedStatus(null, "save", "admin")).toBe("draft");
    expect(savedStatus("review", "save", "reader")).toBe("draft");
  });
});

describe("canEditOwnPost", () => {
  it("stops a reader at publication and lets a writer keep editing", () => {
    expect(canEditOwnPost("review", "reader")).toBe(true);
    expect(canEditOwnPost("published", "reader")).toBe(false);
    expect(canEditOwnPost("published", "writer")).toBe(true);
    expect(canEditOwnPost("archived", "admin")).toBe(false);
  });
});

describe("canWriteKind", () => {
  it("lets any member write community posts and only an admin write news", () => {
    expect(canWriteKind("reader", "community")).toBe(true);
    expect(canWriteKind("organizer", "official")).toBe(false);
    expect(canWriteKind("admin", "official")).toBe(true);
  });
});
