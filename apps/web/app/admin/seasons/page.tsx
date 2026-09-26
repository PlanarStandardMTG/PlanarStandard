import { listSeasons } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";

import { Notice } from "@/components/auth/form-parts";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth/guard";
import { formatDate } from "@/lib/format-date";
import { createSessionClient } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seasons",
  robots: { index: false, follow: false },
};

const DONE: Readonly<Record<string, string>> = {
  created: "Season created, and the ladder recomputed.",
  saved: "Season saved, and the ladder recomputed.",
};

const BUTTON =
  "inline-block shrink-0 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white " +
  "hover:bg-ink-700 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper";

/** Every season, newest first, the current one marked (E20.35). */
export default async function AdminSeasonsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("admin");
  const { done } = await searchParams;
  const seasons = await listSeasons(await createSessionClient());

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Seasons</h1>
          <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">
            The leaderboard rates the current season’s Monthlies, and every tournament belongs to
            the season its date falls in.
          </p>
        </div>
        <Link href="/admin/seasons/new" className={BUTTON}>
          New season
        </Link>
      </header>

      {typeof done === "string" && DONE[done] !== undefined && (
        <Notice tone="good">{DONE[done]}</Notice>
      )}
      {seasons.every((season) => !season.isCurrent) && (
        <Notice tone="warn">
          No season is current, so the leaderboard is empty. Mark one as the current season.
        </Notice>
      )}

      {seasons.length === 0 ? (
        <p className="mt-6 text-sm text-ink-600 dark:text-ink-400">No seasons yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-ink-200 rounded-xl border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
          {seasons.map((season) => (
            <li key={season.id}>
              <Link
                href={`/admin/seasons/${season.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-900"
              >
                <span className="flex items-center gap-3">
                  <span className="font-medium">{season.name}</span>
                  {season.isCurrent && <Badge>Current</Badge>}
                </span>
                <span className="text-xs text-ink-500 dark:text-ink-400">
                  {formatDate(season.startsOn)}
                  {season.endsOn === null ? " – ongoing" : ` – ${formatDate(season.endsOn)}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
