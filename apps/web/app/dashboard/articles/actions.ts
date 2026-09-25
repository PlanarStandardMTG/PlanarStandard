"use server";

import { submissionStatus } from "@ps/core";
import { createPost } from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/guard";
import { sampleArticle } from "@/lib/content/sample-article";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Submit a sample article as the signed-in member (E20.22).
 *
 * The status comes from `submissionStatus`, and `posts_author_insert` checks it
 * again: a reader asking for `published` is refused by the database whatever
 * this function decided. The author is the session's, never the form's.
 */
export async function submitSampleArticle(): Promise<never> {
  const viewer = await requireRole("reader");
  const status = submissionStatus(viewer.profile.role);

  const supabase = await createSessionClient();
  await createPost(supabase, {
    ...sampleArticle(new Date()),
    status,
    kind: "community",
    authorId: viewer.profile.id,
  });

  revalidatePath("/dashboard", "layout");
  if (status === "published") revalidatePath("/articles", "layout");
  redirect(`/dashboard/articles?submitted=${status}`);
}
