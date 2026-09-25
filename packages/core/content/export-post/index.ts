import { absolutizeLinks } from "../../reddit/absolutize-links/index";
import { expandChartShortcodes } from "../../reddit/expand-chart-shortcodes/index";
import { imagesToLinks } from "../../reddit/images-to-links/index";
import { stripHtml } from "../../reddit/strip-html/index";
import { tablesToLists } from "../../reddit/tables-to-lists/index";
import { toRedditMarkdown } from "../../reddit/to-reddit-markdown/index";
import {
  expandEmbeds,
  type EmbedData,
  type ExportTarget,
  type RegisteredEmbed,
} from "../embed-registry/index";

/**
 * A post body, written out for somewhere other than the site (E20.23).
 *
 * Components go first — each one's own export for the target — and then the
 * platform's pipeline, which turns what is left into Markdown that platform
 * renders. Reddit's pipeline is `reddit/to-reddit-markdown`; Discord's is here.
 */
export interface ExportInput {
  readonly markdown: string;
  readonly canonicalUrl: string;
  readonly registry: readonly RegisteredEmbed[];
  readonly data?: EmbedData;
}

/** Discord refuses a longer message outright rather than truncating it. */
export const DISCORD_MESSAGE_LIMIT = 2000;

export function exportPost(input: ExportInput, target: ExportTarget): string {
  const context = { origin: originOf(input.canonicalUrl) };
  const markdown = expandEmbeds(input.markdown, target, input.registry, context, input.data);

  return target === "reddit"
    ? toRedditMarkdown({ markdown, canonicalUrl: input.canonicalUrl })
    : toDiscordMarkdown(markdown, input.canonicalUrl);
}

function toDiscordMarkdown(markdown: string, canonicalUrl: string): string {
  const body = [
    (text: string) => expandChartShortcodes(text, canonicalUrl),
    tablesToLists,
    stripHtml,
    imagesToLinks,
    // Discord renders three heading levels; a fourth shows its hashes.
    (text: string) => text.replace(/^#{4,6}[ \t]/gm, "### "),
    (text: string) => absolutizeLinks(text, canonicalUrl),
  ]
    .reduce<string>((text, step) => step(text), markdown)
    .trim();

  const footer = `Read it on Planar Standard: ${canonicalUrl}`;
  const budget = DISCORD_MESSAGE_LIMIT - footer.length - 2;
  return `${fit(body, budget)}\n\n${footer}`;
}

/** Cut at the last paragraph that fits, never mid-word, and say that it was cut. */
function fit(body: string, budget: number): string {
  if (body.length <= budget) return body;

  const room = budget - 2;
  const paragraph = body.lastIndexOf("\n\n", room);
  const cut = paragraph > room / 2 ? paragraph : body.lastIndexOf(" ", room);
  return `${body.slice(0, cut > 0 ? cut : room).trimEnd()} …`;
}

/** Parsed by hand: core compiles against no DOM and no node lib. */
function originOf(url: string): string {
  return /^(https?:\/\/[^/?#]+)/i.exec(url)?.[1] ?? "";
}
