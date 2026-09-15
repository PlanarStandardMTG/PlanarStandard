import type { Metadata } from "next";
import { listPublishedPostsByKind } from "@ps/db";

import { PostFeedPage } from "@/components/content/post-feed-page";
import { load } from "@/lib/load";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "News",
  description: "Announcements, B&R updates, and event news for the Planar Standard format.",
};

export default async function NewsPage() {
  const posts = await load(() =>
    listPublishedPostsByKind(createPublicClient(), "official", 50),
  );

  return (
    <PostFeedPage
      title="News"
      description="Announcements from the format itself — B&R updates, season openings, and event news."
      posts={posts}
      emptyTitle="No announcements yet"
      emptyBody="B&R updates and season news will be posted here."
    />
  );
}
