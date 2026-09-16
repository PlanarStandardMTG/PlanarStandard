import { describe, expect, it } from "vitest";

import { scopeFor } from "./components";
import { allInfoPages, publishedInfoPages } from "./pages";
import { publishedBody } from "./published-source";
import { syncContent } from "./sync";

describe("content/pages", () => {
  it("parses every page", () => {
    // `allInfoPages` throws with the file name on a bad key, so reaching a
    // non-empty array is the assertion.
    expect(allInfoPages().length).toBeGreaterThan(0);
  });

  it("gives every page a unique navOrder", () => {
    const orders = publishedInfoPages().map((page) => page.frontmatter.navOrder);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("ships the eight pages §25 names, plus the privacy notice", () => {
    // `/privacy` is not in §25's list because §25 predates the site holding
    // anybody's data (E16.12). It is an info page by the same split rule: it
    // describes how the site works, and it should not be editable without a
    // review.
    expect(
      publishedInfoPages()
        .map((page) => page.href)
        .sort(),
    ).toEqual([
      "/about",
      "/faq",
      "/getting-started",
      "/methodology",
      "/organizers",
      "/privacy",
      "/ratings-explained",
      "/resources",
      "/rules",
    ]);
  });

  it("declares only components that are built", () => {
    // A page declaring one that is allowed but not yet implemented throws at
    // render, so this is the check that keeps that from being a 500 in
    // production rather than a red test here.
    for (const page of allInfoPages()) {
      expect(() => scopeFor(page.frontmatter.components), `/${page.slug.join("/")}`).not.toThrow();
    }
  });
});

describe("published definitions do not drift (E17.12)", () => {
  it("keeps every generated region equal to its module doc", () => {
    const stale = syncContent({ write: false }).filter((result) => result.changed);
    expect(
      stale.map((result) => `${result.page} is out of date with ${result.source}`),
      "run `pnpm content:sync`",
    ).toEqual([]);
  });

  it("checks at least the two pages that have a source", () => {
    const synced = syncContent({ write: false });
    expect(synced.map((result) => result.source).sort()).toEqual([
      "docs/modules/metrics.md",
      "docs/modules/ratings.md",
    ]);
  });

  it("publishes the definitions themselves, not the doc's own notes", () => {
    const body = publishedBody(
      [
        "preamble",
        "<!-- publish:start -->",
        "<!-- publish:omit -->",
        "_Module: core/whatever._",
        "",
        "The definition.",
        "<!-- publish:end -->",
        "trailing",
      ].join("\n"),
    );
    expect(body).toBe("The definition.");
  });

  it("omits the note even when a formatter puts a blank line after the marker", () => {
    const body = publishedBody(
      [
        "<!-- publish:start -->",
        "<!-- publish:omit -->",
        "",
        "_Module: core/whatever._",
        "",
        "The definition.",
        "<!-- publish:end -->",
      ].join("\n"),
    );
    expect(body).toBe("The definition.");
  });
});
