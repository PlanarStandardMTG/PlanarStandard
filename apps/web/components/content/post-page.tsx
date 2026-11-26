import type { PostKind } from "@ps/contracts";
import { getPublishedPostBySlug } from "@ps/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PostArticle } from "@/components/content/post-article";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/states";
import { load } from "@/lib/load";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { createPublicClient } from "@/lib/supabase/server";

/**
 * The detail route for one kind of post.
 *
 * `/news/[slug]` and `/community/[slug]` are both this, so the two can never
 * render the same post differently. A slug is unique across both kinds, so the
 * kind check is what stops a community post being readable at a `/news/` URL and vice
 * versa — one post, one canonical address.
 */
const findPost = cache(
  async (slug: string) => await load(() => getPublishedPostBySlug(createPublicClient(), slug)),
);

export async function renderPostPage(slug: string, kind: PostKind) {
  const post = await findPost(slug);

  if (!post.ok) {
    return (
      <Container className="py-12">
        <ErrorState title="Could not load this post" detail={post.error} />
      </Container>
    );
  }

  if (post.value === null || post.value.kind !== kind) notFound();

  return <PostArticle post={post.value} />;
}

export async function postMetadata(slug: string, kind: PostKind): Promise<Metadata> {
  const post = await findPost(slug);
  if (!post.ok || post.value === null || post.value.kind !== kind) return {};

  const { title, excerpt, subtitle, heroImageUrl, publishedAt, updatedAt, author } = post.value;
  return pageMetadata({
    title,
    description: excerpt ?? subtitle ?? undefined,
    path: `/${kind === "official" ? "news" : "community"}/${slug}`,
    image: heroImageUrl,
    article: { publishedTime: publishedAt, modifiedTime: updatedAt, authors: [author.displayName] },
  });
}
