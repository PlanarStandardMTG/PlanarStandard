import { listFormatVersions, listStaleLegalityVersions } from "@ps/db";
import type { Metadata } from "next";

import { Notice } from "@/components/auth/form-parts";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/components/ui/link";
import { requireRole } from "@/lib/auth/guard";
import { createSessionClient } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Formats",
  robots: { index: false, follow: false },
};

const DONE: Readonly<Record<string, string>> = {
  created: "Version created.",
  saved: "Version saved.",
  deleted: "Version deleted.",
};

const BUTTON =
  "inline-block shrink-0 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white " +
  "hover:bg-ink-700 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper";

/** Every version of the format's rules, the one in force first (E20.33). */
export default async function AdminFormatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("admin");
  const { done } = await searchParams;
  const session = await createSessionClient();
  const [versions, stale] = await Promise.all([
    listFormatVersions(session),
    listStaleLegalityVersions(session),
  ]);

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Formats</h1>
          <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">
            Decks and the rules page check against the version in force.
          </p>
        </div>
        <Link href="/admin/formats/new" className={BUTTON}>
          New version
        </Link>
      </header>

      {typeof done === "string" && DONE[done] !== undefined && (
        <Notice tone="good">{DONE[done]}</Notice>
      )}
      {versions.every((version) => !version.isCurrent) && (
        <Notice tone="warn">
          No version is in force, so decks cannot be checked. Mark one as in force.
        </Notice>
      )}
      {stale.size > 0 && (
        <Notice tone="warn">
          Some decks may no longer be legal.{" "}
          <Link href="/admin/processing" className="underline underline-offset-2">
            Recheck decks
          </Link>{" "}
          when you&rsquo;re done editing.
        </Notice>
      )}

      {versions.length === 0 ? (
        <p className="mt-6 text-sm text-ink-600 dark:text-ink-400">No versions yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-ink-200 rounded-xl border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
          {versions.map((version) => (
            <li key={version.id}>
              <Link
                href={`/admin/formats/${version.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-900"
              >
                <span className="flex items-center gap-3">
                  <span className="font-medium">{version.name}</span>
                  {version.isCurrent && <Badge>In force</Badge>}
                  {stale.has(version.id) && <Badge>Decks need rechecking</Badge>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
