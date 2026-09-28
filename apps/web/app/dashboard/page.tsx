import { meetsRole } from "@ps/core";
import type { Metadata } from "next";
import Link from "next/link";

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
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Dashboard</h1>
        <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">
          Your profile, your posts, and everything else your account can do.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <li key={section.href}>
            <Link href={section.href} className="block h-full">
              <Card className="h-full p-5 transition-colors hover:border-eclipse-400 dark:hover:border-eclipse-600">
                <h2 className="font-display text-lg font-semibold">{section.label}</h2>
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
