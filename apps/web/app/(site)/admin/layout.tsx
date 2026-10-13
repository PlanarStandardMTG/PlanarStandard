import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Container } from "@/components/ui/container";
import { ADMIN_SECTIONS } from "@/lib/auth/admin-sections";
import { requireRole } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Everything behind `/admin` (E20.21). Guarded here so a new page under this
 * segment is protected the moment it exists, and again by each page itself —
 * the same arrangement as the dashboard, for the same reason.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireRole("admin");

  return (
    <Container className="py-12">
      <div className="flex flex-col gap-10 md:flex-row">
        <nav aria-label="Admin" className="shrink-0 md:w-52">
          <Link
            href="/admin"
            className="mb-3 block text-xs font-semibold tracking-wide text-ink-500 uppercase hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
          >
            Admin
          </Link>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm md:flex-col">
            {ADMIN_SECTIONS.map((section) => (
              <li key={section.href}>
                <Link
                  href={section.href}
                  className="text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
                >
                  {section.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </Container>
  );
}
