import { meetsRole } from "@ps/core";
import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { DASHBOARD_MINIMUM, DASHBOARD_SECTIONS } from "@/lib/auth/dashboard-sections";
import { requireRole } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

/**
 * What you can do from here (E16.6).
 *
 * Guards again rather than trusting the layout. The layout's check is real, but
 * a page that depends on its parent for authorization is one route move away
 * from having none — and `requireRole` is memoised through `currentViewer`, so
 * asking twice costs one lookup.
 */
export default async function DashboardPage() {
  const viewer = await requireRole(DASHBOARD_MINIMUM);
  const { role } = viewer.profile;
  const sections = DASHBOARD_SECTIONS.filter((section) => meetsRole(role, section.role));

  return (
    <>
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">
          Everything a {role} account can do that a reader cannot. Nothing here is edited by
          deploying the site — that is the point of it.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <li key={section.href}>
            <Card className="h-full p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-lg font-semibold">{section.label}</h2>
                {!section.built && (
                  <span className="shrink-0 text-xs text-ink-400 dark:text-ink-600">
                    {section.story}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm text-ink-600 dark:text-ink-400">{section.description}</p>
            </Card>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm text-ink-500 dark:text-ink-400">
        Sections you cannot reach are not listed. That is a courtesy and not a control — each one
        checks for itself, and the database checks again underneath.
      </p>
    </>
  );
}
