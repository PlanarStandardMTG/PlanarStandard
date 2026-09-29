"use client";

/**
 * A script that runs as the HTML is parsed, before React hydrates. On the
 * client it is inert text, since React warns about rendering a script there
 * and would not run it anyway (the Next guide on preventing flash).
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
