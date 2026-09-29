import type { FormatVersionDetail } from "@ps/contracts";

import type { InfoPage } from "@/lib/info-pages/pages";

import { legalSetsText } from "./page-markdown";

const DISCORD = "https://discord.gg/eeYH9XMCjT";
const REDDIT = "https://www.reddit.com/r/planarMTG/";

/** Which `llms.txt` section an info page belongs in; anything unlisted goes under Optional. */
const SECTIONS: Readonly<Record<string, "rules" | "involved" | "numbers">> = {
  "/rules": "rules",
  "/getting-started": "involved",
  "/ratings-explained": "numbers",
};

/**
 * `/llms.txt` (llmstxt.org): a Markdown index of the site for language models,
 * leading with the rules and how to take part.
 */
export function llmsIndex(
  pages: readonly InfoPage[],
  format: FormatVersionDetail | null,
  origin: string,
): string {
  const link = (page: InfoPage) =>
    `- [${page.frontmatter.title}](${origin}${page.href}): ${page.frontmatter.description}`;
  const section = (key: string) => pages.filter((page) => SECTIONS[page.href] === key).map(link);
  const optional = pages.filter((page) => SECTIONS[page.href] === undefined).map(link);

  return [
    "# Planar Standard",
    "",
    "> A community Magic: The Gathering constructed format with a small, fast-rotating card pool: Foundations plus five rotating sets. This site holds the rules, event results, decklists and an Elo leaderboard.",
    "",
    `${legalSetsText(format)} Any printing of a legal card may be played. Official events are run by the organising group's tournament organisers and announced in the Discord.`,
    "",
    "## Rules",
    "",
    ...section("rules"),
    "",
    "## Get involved",
    "",
    ...section("involved"),
    `- [Events](${origin}/events): upcoming and live tournaments`,
    `- [Community posts](${origin}/community): articles by members; any signed-in member can write one`,
    `- [Discord](${DISCORD}): events, games and announcements`,
    `- [r/planarMTG](${REDDIT}): announcements and discussion`,
    "",
    "## Results and numbers",
    "",
    `- [Leaderboard](${origin}/leaderboard): this season's Elo ratings from Monthly events`,
    `- [Decks](${origin}/decks): public decklists`,
    `- [News](${origin}/news): official announcements`,
    ...section("numbers"),
    "",
    "## Optional",
    "",
    `- [Full text](${origin}/llms-full.txt): every info page in one Markdown file`,
    ...optional,
    "",
  ].join("\n");
}
