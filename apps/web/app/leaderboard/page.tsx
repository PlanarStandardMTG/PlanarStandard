import type { LeaderboardRow } from "@ps/contracts";
import { getCurrentSeason, getLeaderboard, getRatingConfig } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";

import { SeasonBadge } from "@/components/layout/season-badge";
import { RatingsTable } from "@/components/leaderboard/ratings-table";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Pager } from "@/components/ui/pager";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { load } from "@/lib/load";
import { pageOf } from "@/lib/paging";
import { createPublicClient } from "@/lib/supabase/server";

/** Recomputed whenever an event is ingested or a season changes; never pinned to build time. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Elo ratings for the current Planar Standard season, computed from its Monthlies.",
};

/** Enough for a season's field; ranks are places on the whole ladder, so it is read whole. */
const LIMIT = 500;
const PAGE_SIZE = 10;

/**
 * The current season's ladder (E20.12, E20.44), ten to a page and filtered by
 * name. Who qualifies is the `leaderboard` view's question; a player under the
 * event threshold is rated but absent, and the line under the table says why.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = typeof params["q"] === "string" ? params["q"].trim() : "";
  const client = createPublicClient();
  const data = await load(async () => {
    const [season, config, ranked] = await Promise.all([
      getCurrentSeason(client),
      getRatingConfig(client),
      getLeaderboard(client, LIMIT),
    ]);
    return { season, config, ranked };
  });

  return (
    <div className="night flex-1">
      <Container className="py-12">
        <PageHeader kicker="Rated Monthlies" title="Leaderboard" aside={<SeasonBadge large />}>
          Elo ratings from this season&rsquo;s Monthlies.{" "}
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
          <EmptyState title="No season is open">There is no current season.</EmptyState>
        ) : (
          <>
            {data.value.ranked.length === 0 ? (
              <EmptyState title="Nobody is ranked yet">
                The leaderboard fills in after this season&rsquo;s second Monthly.
              </EmptyState>
            ) : (
              <Ladder rows={data.value.ranked} query={query} page={params["page"]} />
            )}
            <p className="mt-8 text-sm text-ink-400">
              Can&rsquo;t find your name? Players need to play in{" "}
              {data.value.config.minEventsForLeaderboard} or more events to appear on the
              leaderboard.
            </p>
          </>
        )}
      </Container>
    </div>
  );
}

function Ladder({
  rows,
  query,
  page,
}: {
  rows: readonly LeaderboardRow[];
  query: string;
  page: string | string[] | undefined;
}) {
  const needle = query.toLowerCase();
  const ranked = rows.map((row, i) => ({ rank: i + 1, row }));
  const matching =
    needle === ""
      ? ranked
      : ranked.filter(({ row }) => row.displayName.toLowerCase().includes(needle));
  const shown = pageOf(matching, page, PAGE_SIZE);
  const href = (n: number) => {
    const search = new URLSearchParams();
    if (query !== "") search.set("q", query);
    if (n > 1) search.set("page", String(n));
    const text = search.toString();
    return `/leaderboard${text === "" ? "" : `?${text}`}`;
  };

  return (
    <>
      <form action="/leaderboard" className="mb-5 flex flex-wrap items-center gap-3 text-sm">
        <label htmlFor="leaderboard-q" className="sr-only">
          Find a player
        </label>
        <input
          id="leaderboard-q"
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Find a player"
          className="w-full max-w-xs rounded-full border border-ink-800 bg-transparent px-4 py-1.5 placeholder:text-ink-600 focus:border-eclipse-500 focus:outline-none sm:w-72"
        />
        <button
          type="submit"
          className="rounded-full border border-ink-800 px-4 py-1.5 hover:border-eclipse-500/60"
        >
          Search
        </button>
        {query !== "" && (
          <>
            <span className="text-ink-400">
              {matching.length} {matching.length === 1 ? "player" : "players"}
            </span>
            <Link href="/leaderboard" className="text-eclipse-400 hover:underline">
              Clear
            </Link>
          </>
        )}
      </form>

      {matching.length === 0 ? (
        <p className="text-ink-400">No ranked player has &ldquo;{query}&rdquo; in their name.</p>
      ) : (
        <RatingsTable rows={shown.items} caption="Ranked players" />
      )}
      <Pager page={shown.page} pages={shown.pages} href={href} />
    </>
  );
}
