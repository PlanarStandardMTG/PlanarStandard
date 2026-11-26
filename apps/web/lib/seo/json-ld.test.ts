import type { PostWithAuthor } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { findInfoPage } from "@/lib/info-pages/pages";

import {
  articleSchema,
  faqEntries,
  faqPageSchema,
  organizationSchema,
  serializeJsonLd,
  websiteSchema,
} from "./json-ld";

const ORIGIN = "https://ps.test";

const post = {
  slug: "season-ii",
  title: "Season II opens",
  subtitle: null,
  excerpt: "Dates and the pool.",
  heroImageUrl: null,
  kind: "official",
  publishedAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-02T00:00:00Z",
  author: { displayName: "Ash" },
} as unknown as PostWithAuthor;

describe("serializeJsonLd", () => {
  it("adds the context and escapes `<`, so a title cannot close the script tag", () => {
    const json = serializeJsonLd(
      articleSchema({ ...post, title: "</script><script>alert(1)</script>" }, ORIGIN),
    );

    expect(json).not.toContain("<");
    expect(JSON.parse(json)).toMatchObject({
      "@context": "https://schema.org",
      headline: "</script><script>alert(1)</script>",
    });
  });
});

describe("site schema", () => {
  it("names the organisation, its logo and its community links", () => {
    expect(organizationSchema(ORIGIN)).toMatchObject({
      "@type": "Organization",
      url: ORIGIN,
      logo: `${ORIGIN}/icon.svg`,
      sameAs: expect.arrayContaining(["https://www.reddit.com/r/planarMTG/"]) as unknown,
    });
    expect(websiteSchema(ORIGIN)).toEqual({
      "@type": "WebSite",
      name: "Planar Standard",
      url: ORIGIN,
    });
  });
});

describe("articleSchema", () => {
  it("makes an official post news from the organisation, with the share image as fallback", () => {
    expect(articleSchema(post, ORIGIN)).toMatchObject({
      "@type": "NewsArticle",
      url: `${ORIGIN}/news/season-ii`,
      description: "Dates and the pool.",
      image: [`${ORIGIN}/opengraph-image`],
      datePublished: "2026-11-01T00:00:00Z",
      dateModified: "2026-11-02T00:00:00Z",
      author: { "@type": "Organization", name: "Planar Standard" },
    });
  });

  it("credits a community post to its writer and uses its hero image", () => {
    const schema = articleSchema(
      { ...post, kind: "community", heroImageUrl: "https://cdn.test/hero.png" },
      ORIGIN,
    );

    expect(schema).toMatchObject({
      "@type": "Article",
      url: `${ORIGIN}/community/season-ii`,
      image: ["https://cdn.test/hero.png"],
      author: { "@type": "Person", name: "Ash" },
    });
  });
});

describe("faqEntries", () => {
  it("pairs each question heading with its answer as plain text", () => {
    const entries = faqEntries(
      [
        "Intro.",
        "",
        "## What is it?",
        "",
        "A [format](/rules) with",
        "**two** years of sets.",
        "",
        "- First item",
        "  wraps.",
        "- Second item",
        "",
        "## Links",
        "",
        "Not a question.",
      ].join("\n"),
    );

    expect(entries).toEqual([
      {
        question: "What is it?",
        answer: "A format with two years of sets.\nFirst item wraps.\nSecond item",
      },
    ]);
  });

  it("finds every question on /faq, each with an answer", () => {
    const page = findInfoPage(["faq"]);
    const headings = page?.body.match(/^## /gm) ?? [];

    const schema = faqPageSchema(faqEntries(page?.body ?? ""));
    expect(schema.mainEntity).toHaveLength(headings.length);
    expect(schema.mainEntity[0]).toMatchObject({
      "@type": "Question",
      name: "What is Planar Standard?",
      acceptedAnswer: { "@type": "Answer" },
    });
  });
});
