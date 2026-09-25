import type { PostStatus, UserRole } from "@ps/contracts";

import { meetsRole } from "../../auth/meets-role/index";

/**
 * Where a post goes when it is submitted, and when it is reviewed (E14.6).
 *
 * Anyone may submit. A writer's submission publishes; anybody below writer
 * waits in `review` for a writer or above. The same rule is RLS on `posts`
 * (migration 0019), which is what actually stops a reader publishing.
 */
export const REVIEWER_ROLE: UserRole = "writer";

export type SubmittedStatus = Extract<PostStatus, "published" | "review">;

export function submissionStatus(role: UserRole): SubmittedStatus {
  return meetsRole(role, REVIEWER_ROLE) ? "published" : "review";
}

export function canReview(role: UserRole): boolean {
  return meetsRole(role, REVIEWER_ROLE);
}

export type ReviewDecision = "approve" | "reject";

/** A rejected post goes back to its author as a draft, not away. */
export function reviewedStatus(
  decision: ReviewDecision,
): Extract<PostStatus, "published" | "draft"> {
  return decision === "approve" ? "published" : "draft";
}

export function isReviewDecision(value: unknown): value is ReviewDecision {
  return value === "approve" || value === "reject";
}
