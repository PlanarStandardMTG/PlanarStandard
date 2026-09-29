import { listPublishedPostSlugs, listTournamentsWithResults } from "@ps/db";
import type { MetadataRoute } from "next";

import { publishedInfoPages } from "@/lib/info-pages/pages";
import { load } from "@/lib/load";
import { siteOrigin } from "@/lib/site-origin";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** More events than the format has run; a sitemap entry each. */
const TOURNAMENTS = 1000;

const SECTIONS = ["/", "/events", "/leaderboard", "/decks", "/news", "/community"];

/** Rules pages rank above the rest; they are what a newcomer or a model is looking for. */
const PRIORITY: Readonly<Record<string, number>> = {
  "/": 1,
  "/rules": 0.9,
  "/getting-started": 0.9,
  "/events": 0.8,
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const client = createPublicClient();
  const [posts, tournaments] = await Promise.all([
    load(async () => await listPublishedPostSlugs(client)),
    load(async () => await listTournamentsWithResults(client, TOURNAMENTS)),
  ]);

  const paths = [
    ...SECTIONS,
    ...publishedInfoPages().map((page) => page.href),
    ...(posts.ok
      ? posts.value.map(
          (post) => `/${post.kind === "official" ? "news" : "community"}/${post.slug}`,
        )
      : []),
    ...(tournaments.ok ? tournaments.value.map((t) => `/tournaments/${t.slug}`) : []),
  ];

  return paths.map((path) => ({
    url: `${origin}${path === "/" ? "" : path}`,
    priority: PRIORITY[path] ?? 0.5,
  }));
}
