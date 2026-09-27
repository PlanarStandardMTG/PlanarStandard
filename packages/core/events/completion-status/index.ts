import type { EventCompletion } from "@ps/contracts";

/**
 * Where one finished tournament stands in the fetch queue (E23.13, E25.2) — and the two
 * numbers that decide it, which the runner and the admin page must agree on.
 */

/** A runner that has held an event this long without finishing is presumed dead. */
export const COMPLETION_LEASE_MS = 15 * 60 * 1000;

/** After this many failed tries an event stays queued but is no longer claimed. */
export const COMPLETION_MAX_ATTEMPTS = 5;

export type CompletionStatus = "fetched" | "running" | "waiting" | "retrying" | "gave-up";

export function completionStatus(completion: EventCompletion, now: Date): CompletionStatus {
  if (completion.processedAt !== null) return "fetched";

  const claimed = completion.claimedAt === null ? null : Date.parse(completion.claimedAt);
  if (claimed !== null && now.getTime() - claimed < COMPLETION_LEASE_MS) return "running";

  if (completion.attempts >= COMPLETION_MAX_ATTEMPTS) return "gave-up";
  return completion.attempts > 0 ? "retrying" : "waiting";
}
