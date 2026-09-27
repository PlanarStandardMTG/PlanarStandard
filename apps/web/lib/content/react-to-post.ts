"use server";

import { isPostReaction } from "@ps/core";
import { setOwnPostReaction } from "@ps/db";
import { refresh } from "next/cache";

import { currentViewer } from "@/lib/auth/viewer";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Set or take back the viewer's reaction to a post (E20.41). The policies on
 * `post_reactions` decide whether they may — signed in, not banned, published
 * post — so this only refuses what it cannot even ask.
 */
export async function reactToPost(postId: string, reaction: string | null): Promise<void> {
  const viewer = await currentViewer();
  if (viewer === null) throw new Error("Sign in to react.");
  if (reaction !== null && !isPostReaction(reaction)) throw new Error("Not a reaction.");

  await setOwnPostReaction(await createSessionClient(), postId, viewer.profile.id, reaction);
  refresh();
}
