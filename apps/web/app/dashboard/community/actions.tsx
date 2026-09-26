"use server";

import type { PostKind, PostWithAuthor } from "@ps/contracts";
import {
  EMBED_REGISTRY,
  TOURNAMENT_SHOW,
  canEditOwnPost,
  canWriteKind,
  checkPostDraft,
  exportPost,
  ordinal,
  postSlug,
  savedStatus,
  type DraftProblem,
  type PostDraftInput,
} from "@ps/core";
import {
  POST_IMAGE_MAX_BYTES,
  POST_IMAGE_TYPES,
  createPost,
  getPostForEditing,
  getTournamentBySlug,
  listTournamentFinishers,
  storePostImage,
  updatePost,
} from "@ps/db";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { PostArticleContent } from "@/components/content/post-article";
import { loadEmbedData } from "@/components/content/embeds/load";
import { requireRole } from "@/lib/auth/guard";
import { feedHref, postHref } from "@/lib/post-url";
import { siteOrigin } from "@/lib/site-origin";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Save and preview a post, community or news (E20.2).
 *
 * The author is always the session's. The status comes from `savedStatus`, and
 * `posts_author_insert` / `posts_author_update` check it again underneath — a
 * reader asking to publish is refused by the database whatever happens here.
 */
export interface SaveState {
  readonly problems: readonly DraftProblem[];
  /** Set when the save failed for a reason that is not the author's input. */
  readonly failed?: "not-editable" | "not-allowed";
}

function fields(form: FormData): PostDraftInput {
  const text = (name: string) => form.get(name)?.toString() ?? "";
  return {
    title: text("title"),
    subtitle: text("subtitle"),
    excerpt: text("excerpt"),
    tags: text("tags"),
    bodyMarkdown: text("bodyMarkdown"),
  };
}

export async function savePost(_previous: SaveState, form: FormData): Promise<SaveState> {
  const viewer = await requireRole("reader");
  const id = form.get("id")?.toString() ?? "";
  const intent = form.get("intent") === "submit" ? "submit" : "save";

  const check = checkPostDraft(fields(form), intent, EMBED_REGISTRY);
  if (!check.ok) return { problems: check.problems };

  const supabase = await createSessionClient();
  const { role } = viewer.profile;
  let saved: PostWithAuthor;

  if (id === "") {
    // A kind is chosen once, on creation. `posts_author_insert` refuses an
    // official post from anyone but an admin whatever this says.
    const kind: PostKind = form.get("kind") === "official" ? "official" : "community";
    if (!canWriteKind(role, kind)) return { problems: [], failed: "not-allowed" };

    const status = savedStatus(null, intent, role);
    const base = postSlug(check.draft.title) || "post";
    const post = {
      ...check.draft,
      status,
      kind,
      authorId: viewer.profile.id,
    };
    try {
      saved = await createPost(supabase, { ...post, slug: base });
    } catch (cause) {
      if (!isDuplicate(cause)) throw cause;
      // Slugs are unique across every post; a second post with the same
      // title gets a short suffix rather than an error.
      saved = await createPost(supabase, { ...post, slug: `${base}-${suffix()}` });
    }
  } else {
    const existing = await getPostForEditing(supabase, id);
    if (
      existing === null ||
      existing.authorId !== viewer.profile.id ||
      !canEditOwnPost(existing.status, role)
    ) {
      return { problems: [], failed: "not-editable" };
    }
    const status = savedStatus(existing.status, intent, role);
    saved = await updatePost(supabase, id, { ...check.draft, status });
  }

  revalidatePath("/dashboard", "layout");
  if (saved.status === "published") revalidatePath(feedHref(saved.kind), "layout");
  redirect(`/dashboard/community/${saved.id}/edit?saved=${saved.status}`);
}

export interface Preview {
  readonly rendered: ReactNode;
  readonly reddit: string;
  readonly discord: string;
}

/**
 * The post as it would be published, and as it would be exported, from what
 * is in the editor now — nothing is saved. Rendered here rather than in the
 * browser so components can load what they show, and so the preview is the
 * same `PostArticleContent` the published page uses.
 */
export async function previewPost(
  input: PostDraftInput & { slug: string; kind: PostKind },
): Promise<Preview> {
  const viewer = await requireRole("reader");

  const slug = input.slug || postSlug(input.title) || "post";
  const kind: PostKind = input.kind === "official" ? "official" : "community";
  const canonicalUrl = `${await siteOrigin()}${postHref({ slug, kind })}`;
  const markdown = input.bodyMarkdown;
  const tidied = checkPostDraft(input, "save", EMBED_REGISTRY);
  const data = await loadEmbedData(markdown);
  const now = new Date().toISOString();

  const post: PostWithAuthor = {
    id: "preview",
    slug,
    title: input.title.trim() || "Untitled",
    subtitle: input.subtitle.trim() || null,
    bodyMarkdown: markdown,
    excerpt: input.excerpt.trim() || null,
    heroImageUrl: null,
    // As a save would store them, when they are valid enough to be saved.
    tags: tidied.ok ? tidied.draft.tags : [],
    status: "draft",
    kind,
    authorId: viewer.profile.id,
    publishedAt: now,
    redditUrl: null,
    redditPostedAt: null,
    createdAt: now,
    updatedAt: now,
    author: {
      id: viewer.profile.id,
      displayName: viewer.profile.displayName,
      handle: viewer.profile.handle,
      avatarUrl: viewer.profile.avatarUrl,
    },
  };

  const exported = { markdown, canonicalUrl, registry: EMBED_REGISTRY, data };
  return {
    rendered: <PostArticleContent post={post} />,
    reddit: exportPost(exported, "reddit"),
    discord: exportPost(exported, "discord"),
  };
}

export type UploadResult =
  { readonly ok: true; readonly url: string } | { readonly ok: false; readonly problem: string };

/** One picture for the image component (E20.25), into the author's own folder. */
export async function uploadPostImage(form: FormData): Promise<UploadResult> {
  await requireRole("reader");
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, problem: "Choose an image." };

  const extension = POST_IMAGE_TYPES[file.type];
  if (extension === undefined) {
    return { ok: false, problem: "Use a PNG, JPEG, WebP or GIF image." };
  }
  if (file.size > POST_IMAGE_MAX_BYTES) {
    return { ok: false, problem: "That image is over 4 MB." };
  }

  try {
    const url = await storePostImage(await createSessionClient(), {
      name: `${randomUUID()}.${extension}`,
      body: file,
      contentType: file.type,
    });
    return { ok: true, url };
  } catch {
    return { ok: false, problem: "The upload failed. Try again, or link an image instead." };
  }
}

export interface FinisherOption {
  readonly playerSlug: string;
  readonly label: string;
}

/** Who finished within `show`, for attaching a deck to one of them (E20.36). */
export async function listFinisherOptions(
  slug: string,
  show: string,
): Promise<readonly FinisherOption[]> {
  await requireRole("reader");
  const session = await createSessionClient();
  const event = await getTournamentBySlug(session, slug);
  if (event === null) return [];

  const through = TOURNAMENT_SHOW[show as keyof typeof TOURNAMENT_SHOW]?.through ?? 4;
  const finishers = await listTournamentFinishers(session, event.id, through);
  return finishers.flatMap((f) =>
    f.playerSlug === null || f.displayName === null
      ? []
      : [{ playerSlug: f.playerSlug, label: `${f.displayName} (${ordinal(f.placement)})` }],
  );
}

function isDuplicate(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : String(cause);
  return message.includes("23505") || message.toLowerCase().includes("duplicate");
}

function suffix(): string {
  return Math.random().toString(36).slice(2, 7);
}
