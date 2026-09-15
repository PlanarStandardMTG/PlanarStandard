import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Long-form typography.
 *
 * Hand-rolled rather than `@tailwindcss/typography`: the rules that matter here
 * are a dozen lines, and the plugin's opinions would have to be overridden about
 * as often as they are used.
 */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-prose text-[15px]/7 text-ink-800 dark:text-ink-200",
        "[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight",
        "[&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:font-semibold",
        "[&_p]:my-4",
        "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_li]:my-1.5 [&_li]:pl-1",
        "[&_strong]:font-semibold [&_strong]:text-ink-900 dark:[&_strong]:text-ink-100",
        "[&_a]:font-medium [&_a]:text-eclipse-700 [&_a]:underline [&_a]:underline-offset-2 dark:[&_a]:text-eclipse-400",
        "[&_blockquote]:my-5 [&_blockquote]:border-l-2 [&_blockquote]:border-eclipse-500 [&_blockquote]:pl-4 [&_blockquote]:italic",
        "[&_code]:rounded [&_code]:bg-ink-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] dark:[&_code]:bg-ink-800",
        "[&_hr]:my-8 [&_hr]:border-ink-200 dark:[&_hr]:border-ink-800",
        className,
      )}
    >
      {children}
    </div>
  );
}
