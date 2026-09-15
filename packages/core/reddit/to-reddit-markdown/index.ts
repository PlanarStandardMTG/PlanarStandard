import type { RedditConversionInput } from "@ps/contracts";

import { absolutizeLinks } from "../absolutize-links/index";
import { expandChartShortcodes } from "../expand-chart-shortcodes/index";
import { imagesToLinks } from "../images-to-links/index";
import { stripHtml } from "../strip-html/index";
import { tablesToLists } from "../tables-to-lists/index";

/** Marks where the backlink begins, so a second pass can recognise its own work. */
const BACKLINK_PREFIX = "*Originally published at";

/**
 * The whole pipeline, plus the canonical backlink.
 *
 * Order matters: shortcodes expand into Markdown links, so they go first;
 * `absolutize-links` runs last so it catches the relative links the earlier
 * steps produced.
 *
 * Idempotent — running it over its own output returns that output unchanged,
 * which matters because "Copy for Reddit" is a button a writer will press twice.
 */
export function toRedditMarkdown({ markdown, canonicalUrl }: RedditConversionInput): string {
  const body = [
    (text: string) => expandChartShortcodes(text, canonicalUrl),
    tablesToLists,
    stripHtml,
    imagesToLinks,
    (text: string) => absolutizeLinks(text, canonicalUrl),
  ].reduce<string>((text, step) => step(text), stripBacklink(markdown));

  return `${body.trimEnd()}\n\n${backlink(canonicalUrl)}\n`;
}

function backlink(canonicalUrl: string): string {
  return `${BACKLINK_PREFIX} [${canonicalUrl}](${canonicalUrl})*`;
}

/** Removes a backlink this pipeline added earlier, so a second run does not stack one. */
function stripBacklink(markdown: string): string {
  const index = markdown.lastIndexOf(`\n${BACKLINK_PREFIX}`);
  return index === -1 ? markdown : markdown.slice(0, index);
}
