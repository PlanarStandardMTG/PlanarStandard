"use server";

import { isReviewDecision, reviewedStatus } from "@ps/core";
import { reviewPost } from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/guard";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Approve a submission, or send it back to its author (E20.22).
 *
 * `review_post` checks the caller is a writer again, in the database, and only
 * moves a post that is still in the queue — so a second reviewer arriving late
 * is told so rather than repeating the first one's decision.
 */
export async function reviewSubmission(form: FormData): Promise<never> {
  await requireRole("writer");

  const id = form.get("id")?.toString() ?? "";
  const decision = form.get("decision")?.toString();
  if (id === "" || !isReviewDecision(decision)) redirect("/dashboard/review?error=invalid");

  const supabase = await createSessionClient();
  let moved = true;
  try {
    await reviewPost(supabase, id, reviewedStatus(decision));
  } catch (cause) {
    if (!(cause instanceof Error) || !cause.message.includes("not awaiting review")) throw cause;
    moved = false;
  }

  if (!moved) redirect("/dashboard/review?error=gone");

  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin", "layout");
  if (decision === "approve") revalidatePath("/articles", "layout");
  redirect(`/dashboard/review?done=${decision}`);
}
