import { getCurrentSeason, getLeaderboard, getProvisionalRatings, getRatingConfig } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";

import { SeasonBadge } from "@/components/layout/season-badge";
import { RatingsTable } from "@/components/leaderboard/ratings-table";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { load } from "@/lib/load";
import { createPublicClient } from "@/lib/supabase/server";

/** Recomputed whenever an event is ingested or a season changes; never pinned to build time. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Elo ratings for the current Planar Standard season, computed from its Monthlies.",
};

/** Enough for a season's field; the ladder is small and one page reads better than paging. */
const LIMIT = 500;

/**
 * The current season's ladder (E20.12): who ranks, and on a second tab who is
 * rated but not ranked yet. The two come from the `leaderboard` and `provisional_ratings`
 * views, which split one set of players between them.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const unranked = (await searchParams).view === "unranked";
  const client = createPublicClient();
  const data = await load(async () => {
    const [season, config, ranked, provisional] = await Promise.all([
      getCurrentSeason(client),
      getRatingConfig(client),
      getLeaderboard(client, LIMIT),
      getProvisionalRatings(client, LIMIT),
    ]);
    return { season, config, ranked, provisional };
  });

  return (
    <div className="night flex-1">
      <Container className="py-12">
        <PageHeader kicker="Rated Monthlies" title="Leaderboard" aside={<SeasonBadge large />}>
          Elo ratings from this season&rsquo;s Monthlies, replayed from every result each time one
          comes in.{" "}
          <Link
            href="/ratings-explained"
            className="font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
          >
            How ratings work
          </Link>
        </PageHeader>

        {!data.ok ? (
          <ErrorState title="Could not load the leaderboard" detail={data.error} />
        ) : data.value.season === null ? (
          <EmptyState title="No season is open">
            The leaderboard rates the current season, and there isn&rsquo;t one right now.
          </EmptyState>
        ) : data.value.ranked.length === 0 && data.value.provisional.length === 0 ? (
          <EmptyState title="No rated matches yet">
            Ratings appear once this season&rsquo;s first Monthly has been played and processed.
          </EmptyState>
        ) : (
          <>
            <nav aria-label="Leaderboard" className="mb-6 flex gap-8 border-b border-ink-800">
              {TABS.map((tab) => (
                <Link
                  key={tab.label}
                  href={tab.href}
                  aria-current={tab.unranked === unranked ? "page" : undefined}
                  className="-mb-px border-b-2 border-transparent py-3 text-ink-400 aria-[current=page]:border-gold-400 aria-[current=page]:font-semibold aria-[current=page]:text-ink-100"
                >
                  {tab.label}
                </Link>
              ))}
            </nav>

            {!unranked ? (
              data.value.ranked.length === 0 ? (
                <p className="text-ink-400">
                  Nobody has played {data.value.config.minMatchesForLeaderboard} rated matches yet.
                  Everyone rated so far is under &ldquo;Not ranked yet&rdquo;.
                </p>
              ) : (
                <RatingsTable rows={data.value.ranked} ranked caption="Ranked players" />
              )
            ) : (
              <>
                <p className="mb-4 max-w-prose text-ink-400">
                  A player ranks after {data.value.config.minMatchesForLeaderboard} rated matches.
                  Until {data.value.config.provisionalMatches} their rating is provisional and moves
                  quickly, so these are shown but not placed.
                </p>
                <RatingsTable
                  rows={data.value.provisional}
                  ranked={false}
                  caption="Players not ranked yet"
                />
              </>
            )}
          </>
        )}
      </Container>
    </div>
  );
}

const TABS = [
  { label: "Ranked", href: "/leaderboard", unranked: false },
  { label: "Not ranked yet", href: "/leaderboard?view=unranked", unranked: true },
] as const;
