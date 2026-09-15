import type { ComponentPropsWithoutRef, ReactNode } from "react";

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
        "[&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-ink-100 [&_pre]:p-4 [&_pre]:text-[13px] dark:[&_pre]:bg-ink-900",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-sm",
        "[&_th]:border-b [&_th]:border-ink-300 [&_th]:py-2 [&_th]:pr-4 [&_th]:font-semibold dark:[&_th]:border-ink-700",
        "[&_td]:border-b [&_td]:border-ink-200 [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top dark:[&_td]:border-ink-800",
        "[&_hr]:my-8 [&_hr]:border-ink-200 dark:[&_hr]:border-ink-800",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Element overrides both Markdown renderers pass in — `PostBody` for a post and
 * `renderInfoPage` for an MDX page. The two surfaces read the same, so the
 * overrides live with the typography rather than with either caller.
 */
export const PROSE_MARKDOWN_COMPONENTS = {
  // A table wider than the measure scrolls inside its own box. Without this it
  // pushes the whole page sideways, which is only visible on a phone.
  table: ({ children, ...props }: ComponentPropsWithoutRef<"table">) => (
    <div className="my-5 overflow-x-auto">
      <table {...props}>{children}</table>
    </div>
  ),
};
