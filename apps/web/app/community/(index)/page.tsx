import type { Metadata } from "next";
import { listPublishedPostsByKind } from "@ps/db";

import { PostFeedPage } from "@/components/content/post-feed-page";
import { WritePostButton } from "@/components/content/write-post-button";
import { load } from "@/lib/load";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Community",
  description: "Deck guides, tournament reports, and metagame analysis written by the community.",
};

export default async function CommunityPage() {
  const posts = await load(() => listPublishedPostsByKind(createPublicClient(), "community", 50));

  return (
    <PostFeedPage
      title="Community"
      description="Deck guides, tournament reports, and analysis, written by members of the community under their own names."
      posts={posts}
      action={<WritePostButton kind="community" />}
      emptyTitle="No community posts yet"
      emptyBody="Community writing will show up here once the first piece is published."
    />
  );
}
