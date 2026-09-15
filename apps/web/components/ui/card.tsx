import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-ink-200 bg-white shadow-sm",
        "dark:border-ink-800 dark:bg-ink-900",
        className,
      )}
    >
      {children}
    </div>
  );
}
