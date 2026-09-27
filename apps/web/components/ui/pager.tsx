import Link from "next/link";

/**
 * Previous and next links for a paged list, and where the reader is. The href
 * is the caller's, so the page can keep its other search params and an anchor.
 */
export function Pager({
  page,
  pages,
  href,
  previous = "Previous",
  next = "Next",
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
  previous?: string;
  next?: string;
}) {
  if (pages <= 1) return null;
  const link =
    "rounded-full border border-ink-200 px-3 py-1 hover:border-eclipse-500/60 dark:border-ink-800";
  const off = "rounded-full border border-transparent px-3 py-1 text-ink-400 dark:text-ink-600";

  return (
    <nav aria-label="Pages" className="mt-6 flex items-center justify-between gap-4 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className={link} rel="prev">
          <span aria-hidden="true">←</span> {previous}
        </Link>
      ) : (
        <span className={off}>
          <span aria-hidden="true">←</span> {previous}
        </span>
      )}
      <span className="text-ink-500 tabular-nums dark:text-ink-400">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={link} rel="next">
          {next} <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span className={off}>
          {next} <span aria-hidden="true">→</span>
        </span>
      )}
    </nav>
  );
}
