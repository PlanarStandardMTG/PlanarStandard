import Link from "next/link";

import { publishedInfoPages } from "@/lib/info-pages/pages";

/**
 * The info pages, in `navOrder`. Generated rather than listed, so adding
 * `content/pages/foo.mdx` adds it to the site — the nav is the one thing that
 * would otherwise be forgotten in the PR that adds a page (E17.5).
 */
export function InfoNav({ className }: { className?: string }) {
  const pages = publishedInfoPages();
  if (pages.length === 0) return null;

  return (
    <nav aria-label="About the format" className={className}>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {pages.map((page) => (
          <li key={page.href}>
            <Link
              href={page.href}
              className="text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
            >
              {page.frontmatter.navLabel}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
