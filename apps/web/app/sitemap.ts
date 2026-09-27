import { listPublishedPostSlugs } from "@ps/db";
import type { MetadataRoute } from "next";

import { publishedInfoPages } from "@/lib/info-pages/pages";
import { load } from "@/lib/load";
import { siteOrigin } from "@/lib/site-origin";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SECTIONS = ["/", "/events", "/leaderboard", "/decks", "/news", "/community"];

/** Rules pages rank above the rest; they are what a newcomer or a model is looking for. */
const PRIORITY: Readonly<Record<string, number>> = {
  "/": 1,
  "/rules": 0.9,
  "/getting-started": 0.9,
  "/faq": 0.8,
  "/events": 0.8,
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const posts = await load(async () => await listPublishedPostSlugs(createPublicClient()));

  const paths = [
    ...SECTIONS,
    ...publishedInfoPages().map((page) => page.href),
    ...(posts.ok
      ? posts.value.map(
          (post) => `/${post.kind === "official" ? "news" : "community"}/${post.slug}`,
        )
      : []),
  ];

  return paths.map((path) => ({
    url: `${origin}${path === "/" ? "" : path}`,
    priority: PRIORITY[path] ?? 0.5,
  }));
}
