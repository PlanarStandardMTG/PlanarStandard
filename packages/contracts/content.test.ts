import { describe, expectTypeOf, it } from "vitest";
import type {
  InfoPageComponent,
  InfoPageFrontmatter,
  Post,
  PostRevision,
  PostStatus,
  Profile,
  RedditConversionInput,
  UserRole,
} from "./content";

describe("content contracts", () => {
  it("mirrors a published row of the posts table column for column", () => {
    const post = {
      id: "0f0a4a8e-1c4a-4d1a-9a2f-2b3c4d5e6f70",
      slug: "season-ii-week-4-4c-dragons",
      title: "Season II, Week 4: 4c Dragons Takes the Crown",
      subtitle: "Abzan Midrange answers back on Sunday",
      bodyMarkdown: "## The weekend\n\n4 Bloomvine Regent / Claim Territory made every top eight.",
      excerpt: "4c Dragons put four copies in the top eight.",
      heroImageUrl: "https://planarstandard.com/media/week-4-hero.png",
      tags: ["metagame", "season-ii"],
      status: "published",
      authorId: "9b8c7d6e-5f40-4312-8a19-0c1d2e3f4a5b",
      publishedAt: "2026-09-08T17:00:00.000Z",
      redditUrl: "https://www.reddit.com/r/PlanarStandard/comments/1n4dq2/",
      redditPostedAt: "2026-09-08T17:06:00.000Z",
      createdAt: "2026-09-07T22:14:00.000Z",
      updatedAt: "2026-09-08T17:06:00.000Z",
    } satisfies Post;
    expectTypeOf(post).toExtend<Post>();
  });

  it("keeps every nullable post column present-but-null on a draft", () => {
    const draft = {
      id: "2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f",
      slug: "ratings-after-the-eol-ban",
      title: "Ratings after the ban",
      subtitle: null,
      bodyMarkdown: "",
      excerpt: null,
      heroImageUrl: null,
      tags: [],
      status: "draft",
      authorId: "9b8c7d6e-5f40-4312-8a19-0c1d2e3f4a5b",
      publishedAt: null,
      redditUrl: null,
      redditPostedAt: null,
      createdAt: "2026-09-12T09:30:00.000Z",
      updatedAt: "2026-09-12T09:30:00.000Z",
    } satisfies Post;
    expectTypeOf(draft).toExtend<Post>();
  });

  it("names exactly the four post_status values the publish flow transitions between", () => {
    expectTypeOf<PostStatus>().toEqualTypeOf<"draft" | "review" | "published" | "archived">();
    expectTypeOf<"pending">().not.toExtend<PostStatus>();
  });

  it("records an editor snapshot per revision, author optional once a profile is gone", () => {
    const revision = {
      id: "7a6b5c4d-3e2f-4109-8a7b-6c5d4e3f2a10",
      postId: "0f0a4a8e-1c4a-4d1a-9a2f-2b3c4d5e6f70",
      title: "Season II, Week 4: 4c Dragons Takes the Crown",
      bodyMarkdown: "## The weekend\n\nDraft before the Sunday numbers landed.",
      editedBy: null,
      createdAt: "2026-09-08T11:02:00.000Z",
    } satisfies PostRevision;
    expectTypeOf(revision).toExtend<PostRevision>();
  });

  it("carries the role vocabulary the route guards and the RLS matrix share", () => {
    expectTypeOf<UserRole>().toEqualTypeOf<"reader" | "writer" | "organizer" | "admin">();

    const organizer = {
      id: "9b8c7d6e-5f40-4312-8a19-0c1d2e3f4a5b",
      displayName: "Sunsett",
      handle: "serlupidus",
      avatarUrl: null,
      bio: null,
      role: "organizer",
      createdAt: "2026-02-01T00:00:00.000Z",
    } satisfies Profile;
    expectTypeOf(organizer).toExtend<Profile>();
  });

  it("gives nav generation a label, an order, and a published flag per info page", () => {
    const methodology = {
      title: "Methodology",
      navLabel: "Methodology",
      navOrder: 5,
      description: "How every rate, share, and rating on the site is computed.",
      published: true,
      components: ["Chart"],
    } satisfies InfoPageFrontmatter;

    const unlisted = {
      title: "Resources",
      navLabel: "Resources",
      navOrder: 8,
      description: "Tools, spreadsheets, and Discord servers the community maintains.",
      published: false,
    } satisfies InfoPageFrontmatter;

    expectTypeOf(methodology).toExtend<InfoPageFrontmatter>();
    expectTypeOf(unlisted).toExtend<InfoPageFrontmatter>();
  });

  it("only lets frontmatter name a whitelisted component", () => {
    const rules = {
      title: "Rules",
      navLabel: "Rules",
      navOrder: 2,
      description: "The legal pool and the current banned list, live from the database.",
      published: true,
      components: ["LegalSets", "Banlist"],
    } satisfies InfoPageFrontmatter;

    expectTypeOf(rules).toExtend<InfoPageFrontmatter>();
    expectTypeOf<"Banlist">().toExtend<InfoPageComponent>();
    expectTypeOf<"script">().not.toExtend<InfoPageComponent>();
  });

  it("hands the Reddit pipeline the markdown plus the canonical url it links back to", () => {
    const input = {
      markdown: "## The weekend\n\nSee the [card page](/cards/llanowar-elves).",
      canonicalUrl: "https://planarstandard.com/articles/season-ii-week-4-4c-dragons",
    } satisfies RedditConversionInput;
    expectTypeOf(input).toExtend<RedditConversionInput>();
  });
});
