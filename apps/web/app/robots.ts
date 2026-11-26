import type { MetadataRoute } from "next";

import { publishedInfoPages } from "@/lib/info-pages/pages";
import { siteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

/**
 * Link previews in chat apps. Each fetch is one page someone just shared, so
 * shared deck and event links still unfurl.
 */
const LINK_PREVIEWS = [
  "Discordbot",
  "Twitterbot",
  "facebookexternalhit",
  "Slackbot-LinkExpanding",
  "redditbot",
];

/**
 * Crawlers get the home page, the info pages and the posts, nothing else.
 * Every deck, event and member page is rendered on demand, and crawlers
 * working through them used most of the hosting plan's CPU (E17.17).
 *
 * `$` ends a path, so `/` alone is the home page rather than everything.
 * `/_next/static/` lets a search engine render the pages it may read. The share
 * image and the icon are built once at build time, and are what the pages'
 * Open Graph tags and JSON-LD point to; no `$`, since Next appends a version query.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/$",
          ...publishedInfoPages().map((page) => `${page.href}$`),
          "/news",
          "/community",
          "/llms.txt",
          "/llms-full.txt",
          "/_next/static/",
          "/opengraph-image",
          "/icon.svg",
        ],
        disallow: "/",
      },
      { userAgent: LINK_PREVIEWS, allow: "/" },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
