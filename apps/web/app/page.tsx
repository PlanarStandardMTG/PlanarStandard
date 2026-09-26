import { upcomingEvents } from "@ps/core";
import { listPublishedPostsByKind } from "@ps/db";

import { PostList } from "@/components/content/post-list";
import { EventPodium } from "@/components/home/event-podium";
import { LatestNewsPanel } from "@/components/home/latest-news-panel";
import { NextEventPanel } from "@/components/home/next-event-panel";
import { SeasonBadge } from "@/components/layout/season-badge";
import { Container } from "@/components/ui/container";
import { PlanarMark } from "@/components/ui/planar-mark";
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
    load(() => loadLatestPodium(client)),
    load(() => listPublishedPostsByKind(client, "community", ARTICLE_COUNT)),
  ]);

  // One ordered list of what a player can still turn up to: the head leads the
  // event tile, the next couple sit under it.
  const ahead = events.ok ? upcomingEvents(events.value.schedule) : [];

  return (
    <>
      <section className="night relative overflow-hidden">
        <PlanarMark className="pointer-events-none absolute -top-48 -right-56 size-[46rem] text-ink-900" />
        <Container className="relative grid items-center gap-10 py-14 lg:grid-cols-[1fr_20rem] lg:py-20">
          <div>
            <SeasonBadge />
            <h1 className="mt-6 font-serif text-5xl/[0.98] tracking-tight text-balance sm:text-6xl/[0.95]">
              The record of the <em className="text-gold-400">Planar Standard</em> format
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-300">
              Metagame analytics, an Elo leaderboard, and decklist validation — computed from every
              event, by code you can read.
            </p>
          </div>

          {/* `min-w-0`: a grid cell is otherwise as wide as its longest
              unbreakable line, and a long event name pushed past a phone's margin. */}
          <div className="relative min-w-0 lg:pt-44">
            <PlanarMark className="absolute -top-6 left-1/2 hidden size-64 -translate-x-1/2 text-gold-400 lg:block" />
            <div className="relative">
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
        </Container>
      </section>

      <Container className="space-y-14 py-12">
        {!podium.ok ? (
          <ErrorState title="Could not load the last event's decks" detail={podium.error} />
        ) : (
          podium.value !== null && <EventPodium podium={podium.value} />
        )}

        <div className="grid items-start gap-12 lg:grid-cols-12">
          <section className="min-w-0 lg:col-span-7">
            <SectionHeading>From the format</SectionHeading>
            {news.ok ? (
              <LatestNewsPanel posts={news.value} />
            ) : (
              <ErrorState title="Could not load the latest news" detail={news.error} />
            )}
          </section>

          <section className="min-w-0 lg:col-span-5">
            <SectionHeading href="/community" linkLabel="All">
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
        </div>
      </Container>
    </>
  );
}
