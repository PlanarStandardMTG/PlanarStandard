import type { PostWithAuthor } from "@ps/contracts";

import { COMMUNITY_LINKS } from "@/lib/community-links";

import { SHARE_IMAGE, SITE_NAME } from "./page-metadata";

/** The schema.org shapes this site publishes, and only the fields it fills. */

interface Thing {
  readonly "@context"?: "https://schema.org";
}

export interface Organization extends Thing {
  readonly "@type": "Organization";
  readonly name: string;
  readonly url: string;
  readonly logo?: string;
  readonly sameAs?: readonly string[];
}

export interface Person {
  readonly "@type": "Person";
  readonly name: string;
}

export interface WebSite extends Thing {
  readonly "@type": "WebSite";
  readonly name: string;
  readonly url: string;
}

export interface Article extends Thing {
  readonly "@type": "Article" | "NewsArticle";
  readonly headline: string;
  readonly description?: string;
  readonly url: string;
  readonly mainEntityOfPage: string;
  readonly image: readonly string[];
  readonly datePublished?: string;
  readonly dateModified: string;
  readonly author: Organization | Person;
  readonly publisher: Organization;
}

export interface FaqPage extends Thing {
  readonly "@type": "FAQPage";
  readonly mainEntity: readonly {
    readonly "@type": "Question";
    readonly name: string;
    readonly acceptedAnswer: { readonly "@type": "Answer"; readonly text: string };
  }[];
}

export type JsonLdData = Organization | WebSite | Article | FaqPage;

/** `<` escaped, so text from a post cannot close the script tag it is written into. */
export function serializeJsonLd(data: JsonLdData): string {
  return JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c");
}

export function organizationSchema(origin: string): Organization {
  return {
    "@type": "Organization",
    name: SITE_NAME,
    url: origin,
    logo: `${origin}/icon.svg`,
    sameAs: COMMUNITY_LINKS.map((link) => link.href),
  };
}

export function websiteSchema(origin: string): WebSite {
  return { "@type": "WebSite", name: SITE_NAME, url: origin };
}

/** An official post speaks for the format, so it is news from the organisation. */
export function articleSchema(post: PostWithAuthor, origin: string): Article {
  const url = `${origin}/${post.kind === "official" ? "news" : "community"}/${post.slug}`;
  const organization: Organization = { "@type": "Organization", name: SITE_NAME, url: origin };
  const description = post.excerpt ?? post.subtitle;

  return {
    "@type": post.kind === "official" ? "NewsArticle" : "Article",
    headline: post.title,
    ...(description === null ? {} : { description }),
    url,
    mainEntityOfPage: url,
    image: [post.heroImageUrl ?? `${origin}${SHARE_IMAGE.url}`],
    ...(post.publishedAt === null ? {} : { datePublished: post.publishedAt }),
    dateModified: post.updatedAt,
    author:
      post.kind === "official"
        ? organization
        : { "@type": "Person", name: post.author.displayName },
    publisher: { ...organization, logo: `${origin}/icon.svg` },
  };
}

export interface FaqEntry {
  readonly question: string;
  readonly answer: string;
}

/**
 * The question-and-answer pairs of a Markdown page: each `##` heading ending in
 * `?`, and the text under it as plain text, one paragraph or list item a line.
 */
export function faqEntries(markdown: string): readonly FaqEntry[] {
  return markdown
    .split(/^## /m)
    .slice(1)
    .map((section) => {
      const [heading = "", ...body] = section.split("\n");
      return { question: heading.trim(), answer: plainText(body) };
    })
    .filter((entry) => entry.question.endsWith("?") && entry.answer !== "");
}

export function faqPageSchema(entries: readonly FaqEntry[]): FaqPage {
  return {
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

const LIST_ITEM = /^\s*- /;

function plainText(lines: readonly string[]): string {
  const blocks: string[][] = [];
  for (const line of lines) {
    if (line.trim() === "") blocks.push([]);
    else if (LIST_ITEM.test(line) || blocks.length === 0)
      blocks.push([line.replace(LIST_ITEM, "")]);
    else blocks.at(-1)?.push(line);
  }
  return blocks
    .map((block) =>
      block
        .join(" ")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((text) => text !== "")
    .join("\n");
}
