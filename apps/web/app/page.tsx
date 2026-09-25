import { upcomingEvents } from "@ps/core";
import { listPublishedPostsByKind } from "@ps/db";

import { PostList } from "@/components/content/post-list";
import { EventPodium } from "@/components/home/event-podium";
import { LatestNewsPanel } from "@/components/home/latest-news-panel";
import { NextEventPanel } from "@/components/home/next-event-panel";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { ErrorState } from "@/components/ui/states";
import { loadEvents } from "@/lib/events/sync-events.server";
import { load } from "@/lib/load";
import { loadLatestPodium } from "@/lib/podium/latest-podium";
import { createPublicClient } from "@/lib/supabase/server";

// Posts are published from the site, not from a deploy, and `/events` refreshes
// a third-party calendar during the render, so the home page must not be baked
// at build time.
export const dynamic = "force-dynamic";

const NEWS_COUNT = 4;
const ARTICLE_COUNT = 3;
/** The next event gets the tile; these are the ones listed under it. */
const FOLLOWING_EVENT_COUNT = 2;

/**
 * Four regions, and each one is loaded independently.
 *
 * `load` per region rather than one try around the page: a database that cannot
 * answer for posts should cost the news tile and not the event beside it.
 * Everything is fetched in parallel — one `Promise.all`, not four sequential
 * awaits, which on a page that refreshes a third-party calendar mid-render is
 * the difference between fast and noticeably not.
 */
export default async function HomePage() {
  const now = new Date();
  const client = createPublicClient();

  const [news, events, podium, community] = await Promise.all([
    load(() => listPublishedPostsByKind(client, "official", NEWS_COUNT)),
    load(() => loadEvents(now)),
    load(() => loadLatestPodium()),
    load(() => listPublishedPostsByKind(client, "community", ARTICLE_COUNT)),
  ]);

  // One ordered list of what a player can still turn up to: the head leads the
  // event tile, the next couple sit under it.
  const ahead = events.ok ? upcomingEvents(events.value.schedule) : [];

  return (
    <Container className="py-10 sm:py-14">
      <section className="max-w-2xl">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          The record of the{" "}
          <span className="text-eclipse-600 dark:text-eclipse-400">Planar Standard</span> format
        </h1>
        <p className="mt-3 text-lg text-ink-600 dark:text-ink-400">
          Metagame analytics, an Elo leaderboard, and decklist validation — computed from every
          event, by code you can read.
        </p>
      </section>

      {/* The lead tile takes two of three columns, so it reads as the larger
          square next to the event rather than as a row of two equal cards. Both
          stretch to the taller of the two. */}
      <div className="mt-8 grid items-stretch gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {news.ok ? (
            <LatestNewsPanel posts={news.value} />
          ) : (
            <ErrorState title="Could not load the latest news" detail={news.error} />
          )}
        </div>

        <div>
          {events.ok ? (
            <NextEventPanel
              event={ahead[0] ?? null}
              then={ahead.slice(1, 1 + FOLLOWING_EVENT_COUNT)}
            />
          ) : (
            <ErrorState title="Could not load the schedule" detail={events.error} />
          )}
        </div>
      </div>

      <div className="mt-12">
        {!podium.ok ? (
          <ErrorState title="Could not load the last event's decks" detail={podium.error} />
        ) : (
          podium.value !== null && (
            <EventPodium podium={podium.value.podium} sample={podium.value.sample} />
          )
        )}
      </div>

      <section className="mt-12">
        <SectionHeading href="/community" linkLabel="All community posts">
          From the community
        </SectionHeading>

        {community.ok ? (
          <PostList
            posts={community.value}
            compact
            showKind={false}
            emptyTitle="No community posts yet"
            emptyBody="Members write these under their own byline. Announcements from the format are in news."
          />
        ) : (
          <ErrorState title="Could not load recent community posts" detail={community.error} />
        )}
      </section>
    </Container>
  );
}
