import type { PostKind, PostStatus, UserRole } from "@ps/contracts";

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

/**
 * The status an author's save lands in (E20.2). Submitting goes where
 * `submissionStatus` says. Saving keeps a writer's published post live — they
 * are correcting it, not withdrawing it — and anything else becomes a draft,
 * which takes a waiting post back out of the queue.
 */
export function savedStatus(
  current: PostStatus | null,
  intent: "save" | "submit",
  role: UserRole,
): Extract<PostStatus, "draft" | "review" | "published"> {
  if (intent === "submit") return submissionStatus(role);
  return current === "published" && canReview(role) ? "published" : "draft";
}

/** Whether an author may still change a post: a reader's stops at publication. */
export function canEditOwnPost(status: PostStatus, role: UserRole): boolean {
  return status === "draft" || status === "review" || (status === "published" && canReview(role));
}

/**
 * Who may write which kind. `community` is any member under their own name;
 * `official` is the format's own voice — news, B&R notices — so admins only.
 * `posts_author_insert` says the same (migration 0019).
 */
export function canWriteKind(role: UserRole, kind: PostKind): boolean {
  return meetsRole(role, kind === "official" ? "admin" : "reader");
}
