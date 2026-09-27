import type { OracleId } from "@ps/contracts";

import { cardIndex } from "@/lib/cards/card-index";
import { loadCurrentFormat } from "@/lib/format/current-format";
import { publishedInfoPages } from "@/lib/info-pages/pages";
import { pageMarkdown } from "@/lib/llms/page-markdown";
import { siteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

/** Every published info page in one Markdown file, rules first. */
export async function GET(): Promise<Response> {
  const [format, origin] = await Promise.all([loadCurrentFormat(), siteOrigin()]);
  const cards = cardIndex().byOracleId;
  const context = {
    origin,
    format: format.ok ? format.value : null,
    cardName: (id: OracleId) => cards.get(id)?.card.name ?? id,
  };

  const rulesFirst = [...publishedInfoPages()].sort(
    (a, b) => Number(b.href === "/rules") - Number(a.href === "/rules"),
  );
  const body = [
    "# Planar Standard",
    "",
    ...rulesFirst.map(
      (page) =>
        `## ${page.frontmatter.title}\n\nSource: ${origin}${page.href}\n\n${demote(pageMarkdown(page.body, context))}\n`,
    ),
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}

/** A page's own headings sit one level under its title. */
function demote(markdown: string): string {
  return markdown.replace(/^(#{1,5}) /gm, "#$1 ");
}
