import { completionStatus } from "@ps/core";
import { listCompletions, listFormatVersions, listMembers, listPostsAwaitingReview } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { ADMIN_SECTIONS } from "@/lib/auth/admin-sections";
import { requireRole } from "@/lib/auth/guard";
import { createSessionClient } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/** The admin landing page: every section, and how much is waiting in each (E20.21). */
export default async function AdminPage() {
  await requireRole("admin");

  const supabase = await createSessionClient();
  const [members, queue, formats, completions] = await Promise.all([
    listMembers(supabase),
    listPostsAwaitingReview(supabase),
    listFormatVersions(supabase),
    listCompletions(supabase, 200),
  ]);
  const now = new Date();
  const unprocessed = completions.filter(
    (completion) => completionStatus(completion, now) !== "processed",
  ).length;

  const figures: Readonly<Record<string, string>> = {
    "/admin/users": `${members.length} ${members.length === 1 ? "member" : "members"}`,
    "/admin/formats": formats.find((version) => version.isCurrent)?.name ?? "None in force",
    "/admin/processing": `${unprocessed} waiting`,
    "/dashboard/review": `${queue.length} waiting`,
  };

  return (
    <>
      <header className="mb-8">
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Admin</h1>
        <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">
          Who can do what on the site, and what is waiting on somebody to decide.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {ADMIN_SECTIONS.map((section) => (
          <li key={section.href}>
            <Link href={section.href} className="block h-full">
              <Card className="h-full p-5 transition-colors hover:border-eclipse-400 dark:hover:border-eclipse-600">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-serif text-lg font-semibold">{section.label}</h2>
                  {figures[section.href] !== undefined && (
                    <span className="shrink-0 text-sm text-ink-500 dark:text-ink-400">
                      {figures[section.href]}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-ink-600 dark:text-ink-400">
                  {section.description}
                </p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
