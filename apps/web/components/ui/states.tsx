import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Card } from "./card";

/**
 * E16.8 — the three states every data-backed view needs, in one place.
 *
 * Shared rather than per-feature so that "no posts yet" and "the database is
 * unreachable" read the same everywhere, and so that neither one is quietly
 * rendered as an empty div by whoever wrote that page in a hurry.
 */

export function EmptyState({
  title,
  children,
  className,
}: {
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("px-6 py-12 text-center", className)}>
      <p className="font-medium text-ink-700 dark:text-ink-300">{title}</p>
      {children !== undefined && (
        <div className="mx-auto mt-2 max-w-prose text-sm text-ink-500 dark:text-ink-400">
          {children}
        </div>
      )}
    </Card>
  );
}

/**
 * A failure the reader can do nothing about.
 *
 * `detail` is shown only in development: in production it is a stack trace
 * pointed at somebody who came to read an article.
 */
export function ErrorState({
  title = "Something went wrong",
  detail,
  className,
}: {
  title?: string;
  detail?: string;
  className?: string;
}) {
  const showDetail = detail !== undefined && process.env.NODE_ENV !== "production";

  return (
    <Card
      className={cn(
        "border-red-200 bg-red-50/60 px-6 py-10 dark:border-red-900/60 dark:bg-red-950/30",
        className,
      )}
    >
      <p className="font-medium text-red-900 dark:text-red-200">{title}</p>
      <p className="mt-1 text-sm text-red-800/80 dark:text-red-300/80">
        This one is on us, not on you. Try again in a moment.
      </p>
      {showDetail && (
        <pre className="mt-4 overflow-x-auto rounded-lg bg-red-100 p-3 text-xs text-red-900 dark:bg-red-950/60 dark:text-red-200">
          {detail}
        </pre>
      )}
    </Card>
  );
}

/** A block placeholder. Sized by the caller so it matches what is loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-ink-200 dark:bg-ink-800", className)} />;
}
