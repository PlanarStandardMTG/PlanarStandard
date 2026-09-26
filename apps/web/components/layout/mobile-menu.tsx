"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * The header's menu below `xl`, where the nav and the account links do not fit
 * on one line. A `<details>` so it opens without JavaScript; this component
 * only closes it again once a link has been followed, which a `<details>` in a
 * layout that survives client navigation would not do on its own.
 */
export function MobileMenu({ children }: { children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (menu.current !== null) menu.current.open = false;
  }, [pathname]);

  return (
    <details ref={menu} className="group xl:hidden">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-ink-300 px-3 py-1.5 text-sm font-medium text-ink-700 dark:border-ink-700 dark:text-ink-300 [&::-webkit-details-marker]:hidden"
        aria-label="Menu"
      >
        <span aria-hidden="true" className="flex w-4 flex-col gap-[3px]">
          <span className="h-0.5 rounded bg-current transition group-open:translate-y-[5px] group-open:rotate-45" />
          <span className="h-0.5 rounded bg-current transition group-open:opacity-0" />
          <span className="h-0.5 rounded bg-current transition group-open:-translate-y-[5px] group-open:-rotate-45" />
        </span>
        Menu
      </summary>
      <div className="absolute inset-x-0 top-full border-b border-ink-200 bg-paper shadow-lg dark:border-ink-800 dark:bg-ink-950">
        {children}
      </div>
    </details>
  );
}
