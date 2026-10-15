import type { ReactNode } from "react";

/** A one-line outcome above a play page: amber for a refusal, green for done. */
export function PlayNotice({ tone, children }: { tone: "warn" | "good"; children: ReactNode }) {
  return (
    <p
      role={tone === "warn" ? "alert" : "status"}
      className={
        tone === "warn"
          ? "rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
          : "rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
      }
    >
      {children}
    </p>
  );
}
