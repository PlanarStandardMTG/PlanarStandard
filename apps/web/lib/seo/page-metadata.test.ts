import { describe, expect, it } from "vitest";

import { pageMetadata, SHARE_IMAGE } from "./page-metadata";

describe("pageMetadata", () => {
  it("sets the canonical URL and repeats the layout's Open Graph defaults", () => {
    const metadata = pageMetadata({ title: "Rules", description: "The pool.", path: "/rules" });

    expect(metadata.alternates?.canonical).toBe("/rules");
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      siteName: "Planar Standard",
      locale: "en_US",
      url: "/rules",
      title: "Rules",
      description: "The pool.",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", title: "Rules" });
  });

  it("falls back to the site's share image, which a page's own openGraph would drop", () => {
    const metadata = pageMetadata({ title: "Rules", path: "/rules", image: null });

    expect(metadata.openGraph?.images).toEqual([SHARE_IMAGE]);
    expect(metadata.twitter?.images).toEqual([SHARE_IMAGE]);
    expect(metadata).not.toHaveProperty("description");
  });

  it("describes an article with its dates, authors and image", () => {
    const metadata = pageMetadata({
      title: "Season II opens",
      path: "/news/season-ii",
      image: "https://cdn.test/hero.png",
      article: {
        publishedTime: "2026-11-01T00:00:00Z",
        modifiedTime: "2026-11-02T00:00:00Z",
        authors: ["Planar Standard"],
      },
    });

    expect(metadata.openGraph).toMatchObject({
      type: "article",
      publishedTime: "2026-11-01T00:00:00Z",
      modifiedTime: "2026-11-02T00:00:00Z",
      authors: ["Planar Standard"],
      images: ["https://cdn.test/hero.png"],
    });
    expect(metadata.twitter).toMatchObject({ images: ["https://cdn.test/hero.png"] });
  });
});
