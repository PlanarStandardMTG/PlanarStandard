import type { ProfileId } from "@ps/contracts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createPost,
  getPostForEditing,
  getPublishedPostBySlug,
  listPostsAwaitingReview,
  listPostsByAuthor,
  listPublishedPostSlugs,
  listPublishedPostsByKind,
  listRecentPublishedPosts,
  reviewPost,
  updatePost,
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

/** See `repos/events` — deliberately not the production service-role variable (E1.7). */
const serviceKey =
  process.env["SUPABASE_LOCAL_SERVICE_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

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

/**
 * The submission queue (E14.6), as the seeded accounts in `seed/0001_profiles.sql`.
 * Every post made here is removed again by slug prefix.
 */
describe.skipIf(!reachable)("repos/content — submission and review", () => {
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  const prefix = `queue-test-${Date.now()}`;
  let reader: SupabaseClient;
  let writer: SupabaseClient;
  let readerId: ProfileId;
  let writerId: ProfileId;

  async function signIn(email: string): Promise<[SupabaseClient, ProfileId]> {
    const session = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data, error } = await session.auth.signInWithPassword({
      email,
      password: "seed-password-not-a-secret",
    });
    if (error !== null) throw new Error(`could not sign in as ${email}: ${error.message}`);
    const { data: profile } = await service
      .from("profiles")
      .select("id")
      .eq("user_id", data.user.id)
      .single();
    return [session, (profile as { id: ProfileId }).id];
  }

  function draft(suffix: string, authorId: ProfileId, status: "review" | "published") {
    return {
      slug: `${prefix}-${suffix}`,
      title: `Queue test ${suffix}`,
      subtitle: null,
      excerpt: null,
      bodyMarkdown: "Test body.",
      tags: [],
      status,
      kind: "community" as const,
      authorId,
    };
  }

  beforeAll(async () => {
    [reader, readerId] = await signIn("reader@planarstandard.test");
    [writer, writerId] = await signIn("wrenfield@planarstandard.test");
  });

  afterAll(async () => {
    await service.from("posts").delete().like("slug", `${prefix}%`);
  });

  it("holds a reader's submission for review and shows it to its author", async () => {
    const post = await createPost(reader, draft("held", readerId, "review"));

    expect(post.status).toBe("review");
    expect(post.publishedAt).toBeNull();
    expect((await listPostsByAuthor(reader, readerId)).map((p) => p.slug)).toContain(post.slug);
  });

  it("refuses a reader who asks to publish", async () => {
    await expect(createPost(reader, draft("sneaky", readerId, "published"))).rejects.toThrow(
      /row-level security/,
    );
  });

  it("refuses a submission under somebody else's name", async () => {
    await expect(createPost(reader, draft("forged", writerId, "review"))).rejects.toThrow(
      /row-level security/,
    );
  });

  it("publishes a writer's submission and stamps the date", async () => {
    const post = await createPost(writer, draft("direct", writerId, "published"));

    expect(post.status).toBe("published");
    expect(post.publishedAt).not.toBeNull();
  });

  it("shows the queue to a writer and not to a reader", async () => {
    await createPost(reader, draft("queued", readerId, "review"));

    const seen = (await listPostsAwaitingReview(writer)).map((p) => p.slug);
    expect(seen).toContain(`${prefix}-queued`);

    // The reader sees their own, since they wrote it — but not the seeded one.
    const readerSees = await listPostsAwaitingReview(reader);
    expect(readerSees.every((p) => p.authorId === readerId)).toBe(true);
  });

  it("lets a writer approve, and publishes with a date", async () => {
    const post = await createPost(reader, draft("approved", readerId, "review"));
    await reviewPost(writer, post.id, "published");

    const live = await getPublishedPostBySlug(client, post.slug);
    expect(live?.publishedAt).not.toBeNull();
  });

  it("lets a writer send one back to its author as a draft", async () => {
    const post = await createPost(reader, draft("rejected", readerId, "review"));
    await reviewPost(writer, post.id, "draft");

    const mine = await listPostsByAuthor(reader, readerId);
    expect(mine.find((p) => p.id === post.id)?.status).toBe("draft");
  });

  it("does not let a reader review, not even their own", async () => {
    const post = await createPost(reader, draft("self-approved", readerId, "review"));
    await expect(reviewPost(reader, post.id, "published")).rejects.toThrow();
  });

  it("says so when the post has already left the queue", async () => {
    const post = await createPost(reader, draft("twice", readerId, "review"));
    await reviewPost(writer, post.id, "published");
    await expect(reviewPost(writer, post.id, "draft")).rejects.toThrow(/not awaiting review/);
  });

  it("lets an author reopen their own post and save a draft of it", async () => {
    const post = await createPost(reader, draft("edited", readerId, "review"));
    const edit = { ...draft("edited", readerId, "draft"), title: "Edited title" };

    expect((await getPostForEditing(reader, post.id))?.status).toBe("review");
    const saved = await updatePost(reader, post.id, edit);
    expect(saved).toMatchObject({ title: "Edited title", status: "draft" });
  });

  it("does not let a reader edit a post once it is published", async () => {
    const post = await createPost(reader, draft("locked", readerId, "review"));
    await reviewPost(writer, post.id, "published");

    await expect(
      updatePost(reader, post.id, { ...draft("locked", readerId, "published"), title: "Changed" }),
    ).rejects.toThrow();
  });

  it("does not show another member's draft to be edited", async () => {
    const post = await createPost(writer, draft("private", writerId, "published"));
    await updatePost(writer, post.id, {
      ...draft("private", writerId, "published"),
      status: "draft",
    });

    expect(await getPostForEditing(reader, post.id)).toBeNull();
  });
});
