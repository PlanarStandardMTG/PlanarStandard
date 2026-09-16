import { meetsRole } from "@ps/core";
import Link from "next/link";
import type { ReactNode } from "react";

import { Container } from "@/components/ui/container";
import { DASHBOARD_MINIMUM, DASHBOARD_SECTIONS } from "@/lib/auth/dashboard-sections";
import { requireRole } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/**
 * Everything behind `/dashboard` (E16.6).
 *
 * The guard is in the layout, so a new page under this segment is protected the
 * moment it exists rather than the moment somebody remembers. That is the floor,
 * not the whole rule: a section that needs more than `writer` calls
 * `requireRole` again in its own page, because a layout guard cannot express
 * "organizer here, admin there" and a route that relies on its parent for a
 * stricter check is one refactor away from having no check at all.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const viewer = await requireRole(DASHBOARD_MINIMUM);
  const sections = DASHBOARD_SECTIONS.filter((section) =>
    meetsRole(viewer.profile.role, section.role),
  );

  return (
    <Container className="py-12">
      <div className="flex flex-col gap-10 md:flex-row">
        <nav aria-label="Dashboard" className="shrink-0 md:w-52">
          <p className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase dark:text-ink-400">
            Dashboard
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm md:flex-col">
            {sections.map((section) => (
              <li key={section.href}>
                {section.built ? (
                  <Link
                    href={section.href}
                    className="text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
                  >
                    {section.label}
                  </Link>
                ) : (
                  <span
                    className="cursor-default text-ink-400 dark:text-ink-600"
                    title="Not built yet"
                  >
                    {section.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </Container>
  );
}
