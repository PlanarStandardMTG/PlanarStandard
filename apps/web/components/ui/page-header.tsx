import type { ReactNode } from "react";

import { Kicker } from "./marks";

/** The top of a page: a kicker, the title, a line of lede, and anything beside them. */
export function PageHeader({
  kicker,
  title,
  children,
  aside,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-8">
      <div className="max-w-2xl">
        {kicker !== undefined && <Kicker className="mb-3">{kicker}</Kicker>}
        <h1 className="font-serif text-5xl tracking-tight sm:text-6xl">{title}</h1>
        {children !== undefined && (
          <p className="mt-4 text-lg text-ink-600 dark:text-ink-300">{children}</p>
        )}
      </div>
      {aside}
    </header>
  );
}
