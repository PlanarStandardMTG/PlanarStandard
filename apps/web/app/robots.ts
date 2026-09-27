import type { MetadataRoute } from "next";

import { siteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

/** Signed-in and admin surfaces; everything else, AI crawlers included, is welcome. */
const PRIVATE = [
  "/account",
  "/admin",
  "/api/",
  "/auth",
  "/dashboard",
  "/profile",
  "/decks/new",
  "/login",
  "/signup",
  "/forgot-password",
  "/check-email",
  "/unauthorized",
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE },
    sitemap: `${origin}/sitemap.xml`,
  };
}
