import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  getPublishedPostBySlug,
  listPublishedPostSlugs,
  listPublishedPostsByKind,
  listRecentPublishedPosts,
} from "./index";

/**
 * Runs against a local Supabase with the seed loaded (`pnpm db:reset`).
 *
 * Skipped rather than failed when nothing is listening: `db` is the one package
 * allowed to need infrastructure, and the zero-credential promise for everyone
 * else only holds if a missing instance is a skip and not a red suite.
 */
const url = process.env["SUPABASE_URL"] ?? "http://127.0.0.1:54321";
const anonKey =
  process.env["SUPABASE_ANON_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const reachable = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: anonKey },
  signal: AbortSignal.timeout(1500),
})
  .then((r) => r.ok)
  .catch(() => false);

const client = createClient(url, anonKey);

describe.skipIf(!reachable)("repos/content", () => {
  it("lists the newest published posts first", async () => {
    const posts = await listRecentPublishedPosts(client, 5);

    expect(posts).toHaveLength(5);
    const dates = posts.map((p) => p.publishedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("returns only the requested kind", async () => {
    const official = await listPublishedPostsByKind(client, "official", 50);
    const community = await listPublishedPostsByKind(client, "community", 50);

    expect(official.length).toBeGreaterThan(0);
    expect(community.length).toBeGreaterThan(0);
    expect(official.every((p) => p.kind === "official")).toBe(true);
    expect(community.every((p) => p.kind === "community")).toBe(true);
  });

  it("never returns an unpublished post, whichever way it is asked", async () => {
    const all = await listRecentPublishedPosts(client, 100);
    expect(all.every((p) => p.status === "published")).toBe(true);
    expect(all.every((p) => p.publishedAt !== null)).toBe(true);

    // Seeded as a draft, so it exists — RLS is what makes it invisible.
    expect(await getPublishedPostBySlug(client, "season-iii-predictions")).toBeNull();
  });

  it("resolves the author so a byline needs no second query", async () => {
    const post = await getPublishedPostBySlug(client, "the-hub-is-live");

    expect(post?.kind).toBe("official");
    expect(post?.author.displayName).toBe("Planar Standard");
    expect(post?.bodyMarkdown).toContain("## What is here now");
  });

  it("returns null for an unknown slug rather than throwing", async () => {
    expect(await getPublishedPostBySlug(client, "no-such-post")).toBeNull();
  });

  it("lists every published slug with its kind", async () => {
    const slugs = await listPublishedPostSlugs(client);
    const recent = await listRecentPublishedPosts(client, 100);

    expect(slugs).toHaveLength(recent.length);
    expect(slugs.every((s) => s.kind === "official" || s.kind === "community")).toBe(true);
  });
});
