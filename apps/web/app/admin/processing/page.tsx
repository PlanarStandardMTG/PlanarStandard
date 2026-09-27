import { listRatingRuns, listTournamentCoverage } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";

import { Notice } from "@/components/auth/form-parts";
import { InclusionTable } from "@/components/processing/inclusion-table";
import { requireRole } from "@/lib/auth/guard";
import { EVENT_SOURCE_LABELS } from "@/lib/events/source-label";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { createServiceRoleClient } from "@/lib/supabase/service-role.server";
import { createSessionClient } from "@/lib/supabase/session";

import { include, recomputeNow } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Data processing",
  robots: { index: false, follow: false },
};

const BUTTON =
  "rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 " +
  "dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper";

/**
 * What each stored tournament counts towards (E25.3): Elo and card statistics.
 * Every tournament from any source, and no external request — fetching is
 * `/admin/fetching`. Elo choices are staged and applied together, so several
 * changes cost one full replay (ADR 004).
 */
export default async function AdminProcessingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("admin");
  const params = await searchParams;

  const [coverage, [lastRun]] = await Promise.all([
    listTournamentCoverage(await createSessionClient()),
    listRatingRuns(createServiceRoleClient(), 1),
  ]);
  const waiting = coverage.filter((row) => row.includeInElo !== row.tournament.isRated).length;

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Data processing</h1>
        <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">
          What each stored tournament counts towards. This page works on the site&rsquo;s own data
          and never calls melee.gg or Challonge — getting an event&rsquo;s results is{" "}
          <Link
            href="/admin/fetching"
            className="text-eclipse-700 hover:underline dark:text-eclipse-400"
          >
            Event fetching
          </Link>
          . A Monthly starts in both. Elo changes wait until you recompute; card statistics are
          saved as you tick them.
        </p>
      </header>

      {params["done"] === "recomputed" && (
        <Notice tone="good">
          Ratings recomputed
          {params["changed"] === "0"
            ? "."
            : ` with ${String(params["changed"])} Elo ${params["changed"] === "1" ? "change" : "changes"}.`}
        </Notice>
      )}

      <div className="mb-8 flex flex-wrap items-center gap-4 rounded-xl border border-ink-200 px-5 py-4 dark:border-ink-800">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {waiting === 0
              ? "The ladder is up to date"
              : `${waiting} Elo ${waiting === 1 ? "change" : "changes"} waiting`}
          </p>
          <p className="text-xs text-ink-500 dark:text-ink-400">
            {lastRun === undefined
              ? "Ratings have never been computed."
              : `Last recomputed ${formatDateTime(lastRun.createdAt)}.`}
          </p>
        </div>
        <form action={recomputeNow}>
          <button type="submit" className={BUTTON}>
            Recompute ratings
          </button>
        </form>
      </div>

      {coverage.length === 0 ? (
        <p className="text-sm text-ink-600 dark:text-ink-400">No tournament is stored yet.</p>
      ) : (
        <InclusionTable
          rows={coverage.map((row) => ({
            id: row.tournament.id,
            name: row.tournament.name,
            href: `/tournaments/${row.tournament.slug}`,
            detail: `${formatDate(row.tournament.eventDate)} · ${
              row.source === null
                ? "Imported"
                : (EVENT_SOURCE_LABELS[row.source as keyof typeof EVENT_SOURCE_LABELS] ??
                  row.source)
            }`,
            stored: `${row.matches} ${row.matches === 1 ? "match" : "matches"} · ${row.decks} of ${row.entries} decks`,
            rateable: row.matches > 0,
            elo: row.includeInElo,
            eloWaiting: row.includeInElo !== row.tournament.isRated,
            cardStats: row.inCardStats,
          }))}
          include={include}
        />
      )}
    </>
  );
}
