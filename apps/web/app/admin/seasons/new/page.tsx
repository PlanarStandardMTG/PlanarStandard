import type { Metadata } from "next";
import Link from "next/link";

import { saveSeason } from "@/app/admin/seasons/actions";
import { SeasonForm } from "@/components/seasons/season-form";
import { requireRole } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New season",
  robots: { index: false, follow: false },
};

/** A new season, current by default: opening one is usually starting it (E20.35). */
export default async function NewSeasonPage() {
  await requireRole("admin");

  return (
    <>
      <Link
        href="/admin/seasons"
        className="text-sm text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
      >
        <span aria-hidden="true">←</span> Seasons
      </Link>
      <h1 className="mt-2 mb-8 font-serif text-4xl tracking-tight sm:text-5xl">New season</h1>
      <SeasonForm
        id={null}
        initial={{ name: "", startsOn: "", endsOn: "", isCurrent: true }}
        save={saveSeason}
      />
    </>
  );
}
