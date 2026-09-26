import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Long-form typography.
 *
 * Hand-rolled rather than `@tailwindcss/typography`: the rules that matter here
 * are a dozen lines, and the plugin's opinions would have to be overridden about
 * as often as they are used.
 *
 * `in-prose:` (globals.css) stops every rule at `.not-prose`, which a post's
 * components (E20.23) wear so their own headings, lists and links stay theirs.
 */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-prose text-[15px]/7 text-ink-800 dark:text-ink-200",
        "[&_h2]:in-prose:mt-10 [&_h2]:in-prose:mb-3 [&_h2]:in-prose:font-serif [&_h2]:in-prose:text-xl [&_h2]:in-prose:font-semibold [&_h2]:in-prose:tracking-tight",
        "[&_h3]:in-prose:mt-8 [&_h3]:in-prose:mb-2 [&_h3]:in-prose:font-semibold",
        "[&_p]:in-prose:my-4",
        "[&_ul]:in-prose:my-4 [&_ul]:in-prose:list-disc [&_ul]:in-prose:pl-6 [&_ol]:in-prose:my-4 [&_ol]:in-prose:list-decimal [&_ol]:in-prose:pl-6",
        "[&_li]:in-prose:my-1.5 [&_li]:in-prose:pl-1",
        "[&_strong]:in-prose:font-semibold [&_strong]:in-prose:text-ink-900 dark:[&_strong]:in-prose:text-ink-100",
        "[&_a]:in-prose:font-medium [&_a]:in-prose:text-eclipse-700 [&_a]:in-prose:underline [&_a]:in-prose:underline-offset-2 dark:[&_a]:in-prose:text-eclipse-400",
        "[&_blockquote]:in-prose:my-5 [&_blockquote]:in-prose:border-l-2 [&_blockquote]:in-prose:border-eclipse-500 [&_blockquote]:in-prose:pl-4 [&_blockquote]:in-prose:italic",
        "[&_code]:in-prose:rounded [&_code]:in-prose:bg-ink-100 [&_code]:in-prose:px-1.5 [&_code]:in-prose:py-0.5 [&_code]:in-prose:text-[13px] dark:[&_code]:in-prose:bg-ink-800",
        "[&_pre]:in-prose:my-5 [&_pre]:in-prose:overflow-x-auto [&_pre]:in-prose:rounded-lg [&_pre]:in-prose:bg-ink-100 [&_pre]:in-prose:p-4 [&_pre]:in-prose:text-[13px] dark:[&_pre]:in-prose:bg-ink-900",
        "[&_pre_code]:in-prose:bg-transparent [&_pre_code]:in-prose:p-0",
        "[&_table]:in-prose:w-full [&_table]:in-prose:border-collapse [&_table]:in-prose:text-left [&_table]:in-prose:text-sm",
        "[&_th]:in-prose:border-b [&_th]:in-prose:border-ink-300 [&_th]:in-prose:py-2 [&_th]:in-prose:pr-4 [&_th]:in-prose:font-semibold dark:[&_th]:in-prose:border-ink-700",
        "[&_td]:in-prose:border-b [&_td]:in-prose:border-ink-200 [&_td]:in-prose:py-2 [&_td]:in-prose:pr-4 [&_td]:in-prose:align-top dark:[&_td]:in-prose:border-ink-800",
        "[&_hr]:in-prose:my-8 [&_hr]:in-prose:border-ink-200 dark:[&_hr]:in-prose:border-ink-800",
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
