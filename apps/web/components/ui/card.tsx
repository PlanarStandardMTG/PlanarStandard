import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-ink-200 bg-paper shadow-[0_10px_24px_-18px_rgb(26_24_38/0.35)]",
        "dark:border-ink-800 dark:bg-ink-900 dark:shadow-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
