import type { Metadata } from "next";

export const SITE_NAME = "Planar Standard";

/** `app/opengraph-image.tsx`, named outright because a page's own `openGraph` drops the inherited one. */
export const SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Planar Standard: a community Magic: The Gathering format",
} as const;

export interface PageSeo {
  readonly title: string;
  readonly description?: string | undefined;
  /** Site-relative, resolved against the root layout's `metadataBase`. */
  readonly path: string;
  /** Falls back to `SHARE_IMAGE` when absent. */
  readonly image?: string | null | undefined;
  readonly article?: {
    readonly publishedTime: string | null;
    readonly modifiedTime: string;
    readonly authors: readonly string[];
  };
}

/**
 * Title, description, canonical URL and the Open Graph and Twitter cards for one page.
 *
 * A page's `openGraph` replaces the layout's rather than merging with it, so
 * every field the layout sets is set again here.
 */
export function pageMetadata(page: PageSeo): Metadata {
  const description = page.description === undefined ? {} : { description: page.description };
  const images = { images: [page.image ?? SHARE_IMAGE] };

  const card = { siteName: SITE_NAME, locale: "en_US", url: page.path, title: page.title };
  const { article } = page;
  const openGraph: NonNullable<Metadata["openGraph"]> =
    article === undefined
      ? { ...card, type: "website", ...description, ...images }
      : {
          ...card,
          type: "article",
          ...description,
          ...images,
          ...(article.publishedTime === null ? {} : { publishedTime: article.publishedTime }),
          modifiedTime: article.modifiedTime,
          authors: [...article.authors],
        };

  return {
    title: page.title,
    ...description,
    alternates: { canonical: page.path },
    openGraph,
    twitter: { card: "summary_large_image", title: page.title, ...description, ...images },
  };
}
