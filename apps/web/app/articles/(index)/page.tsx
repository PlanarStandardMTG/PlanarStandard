import type { Metadata } from "next";
import { listPublishedPostsByKind } from "@ps/db";

import { PostFeedPage } from "@/components/content/post-feed-page";
import { load } from "@/lib/load";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Articles",
  description: "Deck guides, tournament reports, and metagame analysis written by the community.",
};

export default async function ArticlesPage() {
  const posts = await load(() =>
    listPublishedPostsByKind(createPublicClient(), "community", 50),
  );

  return (
    <PostFeedPage
      title="Articles"
      description="Deck guides, tournament reports, and analysis, written by members of the community under their own names."
      posts={posts}
      emptyTitle="No articles yet"
      emptyBody="Community writing will show up here once the first piece is published."
    />
  );
}
