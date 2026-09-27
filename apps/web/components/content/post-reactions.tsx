import type { PostId, PostKind } from "@ps/contracts";
import { tallyReactions } from "@ps/core";
import { getOwnPostReaction, listPostReactionCounts } from "@ps/db";

import { loginHref } from "@/lib/auth/next-path";
import { currentViewer } from "@/lib/auth/viewer";
import { reactToPost } from "@/lib/content/react-to-post";
import { load } from "@/lib/load";
import { postHref } from "@/lib/post-url";
import { createPublicClient } from "@/lib/supabase/server";
import { createSessionClient } from "@/lib/supabase/session";

import { ReactionBar } from "./reaction-bar";

/** A post's reactions, and the viewer's own if they are signed in (E20.41). */
export async function PostReactions({
  postId,
  slug,
  kind,
}: {
  postId: PostId;
  slug: string;
  kind: PostKind;
}) {
  const viewer = await currentViewer();
  const loaded = await load(async () =>
    Promise.all([
      listPostReactionCounts(createPublicClient(), postId),
      viewer === null ? null : getOwnPostReaction(await createSessionClient(), postId),
    ]),
  );
  // The post is the page; reactions that fail to load are left off it.
  if (!loaded.ok) return null;
  const [rows, mine] = loaded.value;

  return (
    <ReactionBar
      counts={tallyReactions(rows)}
      mine={mine}
      access={
        viewer === null ? "signed-out" : viewer.profile.bannedAt === null ? "member" : "banned"
      }
      loginHref={loginHref(postHref({ slug, kind }))}
      react={reactToPost.bind(null, postId)}
    />
  );
}
