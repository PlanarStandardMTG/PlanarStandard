import Link from "next/link";
import { listRecentPublishedPosts } from "@ps/db";

import { PostList } from "@/components/content/post-list";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { ErrorState } from "@/components/ui/states";
import { load } from "@/lib/load";
import { createPublicClient } from "@/lib/supabase/server";

// Posts are published from the site, not from a deploy, so the home page must
// not be baked at build time.
export const dynamic = "force-dynamic";

const RECENT_POST_COUNT = 5;

export default async function HomePage() {
  const posts = await load(() =>
    listRecentPublishedPosts(createPublicClient(), RECENT_POST_COUNT),
  );

  return (
    <Container className="py-14">
      <section className="max-w-2xl">
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-balance">
          The record of the{" "}
          <span className="text-eclipse-600 dark:text-eclipse-400">Planar Standard</span> format
        </h1>
        <p className="mt-4 text-lg text-ink-600 dark:text-ink-400">
          Metagame analytics, an Elo leaderboard, and decklist validation — computed from every
          event, by code you can read.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link
            href="/news"
            className="rounded-lg bg-eclipse-600 px-4 py-2 font-medium text-white hover:bg-eclipse-700"
          >
            Latest news
          </Link>
          <Link
            href="/articles"
            className="rounded-lg border border-ink-300 px-4 py-2 font-medium hover:border-ink-400 dark:border-ink-700 dark:hover:border-ink-600"
          >
            Community articles
          </Link>
        </div>
      </section>

      <section className="mt-14">
        <SectionHeading href="/articles" linkLabel="All articles">
          Latest
        </SectionHeading>

        {posts.ok ? (
          <>
            <PostList
              posts={posts.value}
              compact
              emptyTitle="No posts yet"
              emptyBody="Announcements and community articles will show up here."
            />
            <p className="mt-5 text-sm text-ink-500 dark:text-ink-400">
              Announcements from the format are in{" "}
              <Link
                href="/news"
                className="font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
              >
                news
              </Link>
              ; everything else is written by the community.
            </p>
          </>
        ) : (
          <ErrorState title="Could not load recent posts" detail={posts.error} />
        )}
      </section>
    </Container>
  );
}
