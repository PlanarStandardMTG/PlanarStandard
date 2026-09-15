// Rows mirror §16 of the master plan; `timestamptz` columns arrive as ISO 8601
// strings and are typed as such.

import type { IsoDateTime } from "./primitives";

export type ProfileId = string;
export type PostId = string;
export type PostRevisionId = string;

export type UserRole = "reader" | "writer" | "organizer" | "admin";

export interface Profile {
  readonly id: ProfileId;
  readonly displayName: string;
  readonly handle: string | null;
  readonly avatarUrl: string | null;
  readonly bio: string | null;
  readonly role: UserRole;
  readonly createdAt: IsoDateTime;
}

export type PostStatus = "draft" | "review" | "published" | "archived";

/** An article written in the site's editor. The body is Markdown (ADR 001). */
export interface Post {
  readonly id: PostId;
  readonly slug: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly bodyMarkdown: string;
  readonly excerpt: string | null;
  readonly heroImageUrl: string | null;
  readonly tags: readonly string[];
  readonly status: PostStatus;
  readonly authorId: ProfileId;
  readonly publishedAt: IsoDateTime | null;
  readonly redditUrl: string | null;
  readonly redditPostedAt: IsoDateTime | null;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

/** One saved state of a post's title and body. Editors append; nothing edits a revision. */
export interface PostRevision {
  readonly id: PostRevisionId;
  readonly postId: PostId;
  readonly title: string;
  readonly bodyMarkdown: string;
  /** Null when the editing profile has since been deleted. */
  readonly editedBy: ProfileId | null;
  readonly createdAt: IsoDateTime;
}

/** The components an info page may embed. MDX executes, so this list is the whitelist (§25). */
export type InfoPageComponent = "LegalSets" | "Banlist" | "Chart";

/** Frontmatter of an MDX file in `content/pages/`. The slug comes from the file path, not from here. */
export interface InfoPageFrontmatter {
  readonly title: string;
  readonly navLabel: string;
  readonly navOrder: number;
  readonly description: string;
  readonly published: boolean;
  readonly components?: readonly InfoPageComponent[];
}

/**
 * Input to `core/reddit/to-reddit-markdown`, which returns plain Reddit-safe Markdown.
 * `canonicalUrl` is both the backlink the pipeline appends and the base `absolutize-links` resolves against.
 */
export interface RedditConversionInput {
  readonly markdown: string;
  readonly canonicalUrl: string;
}
