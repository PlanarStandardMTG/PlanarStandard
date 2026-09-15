import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A section title with an optional link out to the full listing.
 *
 * Used by every "here are the first few of these" block on the site, which is
 * why the link is part of the heading rather than bolted on beneath each list.
 */
export function SectionHeading({
  children,
  href,
  linkLabel = "See all",
}: {
  children: ReactNode;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-ink-200 pb-2 dark:border-ink-800">
      <h2 className="font-serif text-xl font-semibold tracking-tight">{children}</h2>
      {href !== undefined && (
        <Link
          href={href}
          className="shrink-0 text-sm font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
        >
          {linkLabel} <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
