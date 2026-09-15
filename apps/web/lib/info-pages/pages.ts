import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { cache } from "react";

import type { InfoPageFrontmatter } from "@ps/contracts";

import { parseFrontmatter } from "./frontmatter";

/**
 * Reads `content/pages/*.mdx` — the version-controlled, PR-reviewed half of the
 * site's writing (§25). Posts live in Postgres; these do not.
 *
 * Node-only, and only ever called from a server component or from
 * `generateStaticParams`.
 */

const PAGES_DIR = "content/pages";

/**
 * `content/` sits at the repository root, two levels above `apps/web` — which is
 * the cwd for both `next` and `vitest`.
 *
 * One expression rather than a search: Turbopack traces filesystem access
 * statically, and a loop over candidate paths makes it give up and ship the
 * whole repository. `next.config.ts` names this directory in
 * `outputFileTracingIncludes` for the same reason.
 */
function contentRoot(): string {
  const root = resolve(process.cwd(), "..", "..", PAGES_DIR);
  if (!statSync(root).isDirectory()) throw new Error(`not a directory: ${root}`);
  return root;
}

export interface InfoPage {
  /** Path segments, so `[...slug]` can compare without re-splitting. */
  readonly slug: readonly string[];
  readonly href: string;
  readonly frontmatter: InfoPageFrontmatter;
  readonly body: string;
}

function walk(dir: string, prefix: readonly string[]): { slug: string[]; file: string }[] {
  const found: { slug: string[]; file: string }[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...walk(full, [...prefix, entry]));
    } else if (entry.endsWith(".mdx")) {
      found.push({ slug: [...prefix, entry.slice(0, -".mdx".length)], file: full });
    }
  }
  return found;
}

/**
 * Every page in the directory, published or not, ordered by `navOrder`.
 *
 * A malformed page throws here rather than at render: the build should fail on a
 * typo'd key, not serve seven of eight pages.
 */
export const allInfoPages = cache((): readonly InfoPage[] => {
  const root = contentRoot();
  const pages = walk(root, []).map(({ slug, file }) => {
    try {
      const { frontmatter, body } = parseFrontmatter(readFileSync(file, "utf8"));
      return { slug, href: `/${slug.join("/")}`, frontmatter, body };
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`${PAGES_DIR}/${slug.join("/")}.mdx: ${detail}`);
    }
  });

  return pages.sort(
    (a, b) =>
      a.frontmatter.navOrder - b.frontmatter.navOrder || a.href.localeCompare(b.href),
  );
});

/** What the site links to, and what gets a route at all: an unpublished page is not on the site. */
export const publishedInfoPages = cache((): readonly InfoPage[] =>
  allInfoPages().filter((page) => page.frontmatter.published),
);

export function findInfoPage(slug: readonly string[]): InfoPage | null {
  const href = `/${slug.join("/")}`;
  return allInfoPages().find((page) => page.href === href) ?? null;
}
