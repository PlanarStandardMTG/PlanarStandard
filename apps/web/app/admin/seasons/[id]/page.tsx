import type { SeasonId } from "@ps/contracts";
import { getSeason } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { saveSeason } from "@/app/admin/seasons/actions";
import { SeasonForm } from "@/components/seasons/season-form";
import { requireRole } from "@/lib/auth/guard";
import { createSessionClient } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit season",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One season's name, dates and whether it is current (E20.35). */
export default async function EditSeasonPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const season = await getSeason(await createSessionClient(), id as SeasonId);
  if (season === null) notFound();

  return (
    <>
      <Link
        href="/admin/seasons"
        className="text-sm text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
      >
        <span aria-hidden="true">←</span> Seasons
      </Link>
      <h1 className="mt-2 mb-8 font-serif text-4xl tracking-tight sm:text-5xl">{season.name}</h1>
      <SeasonForm
        id={season.id}
        initial={{
          name: season.name,
          startsOn: season.startsOn,
          endsOn: season.endsOn ?? "",
          isCurrent: season.isCurrent,
        }}
        save={saveSeason}
      />
    </>
  );
}
