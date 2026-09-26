import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

const VARIANTS = {
  neutral: "bg-ink-200/70 text-ink-700 dark:bg-ink-800 dark:text-ink-300",
  accent: "bg-gold-700 text-paper dark:bg-gold-400 dark:text-ink-950",
  outline: "border border-ink-300 text-ink-600 dark:border-ink-700 dark:text-ink-400",
} as const;

export type BadgeVariant = keyof typeof VARIANTS;

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
