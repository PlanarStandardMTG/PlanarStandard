import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/ui/container";
import { findInfoPage, publishedInfoPages } from "@/lib/info-pages/pages";
import { renderInfoPage } from "@/lib/info-pages/render";

/**
 * Every MDX info page, at the root of the site: `/about`, `/rules`, and the
 * rest. The `(info)` group keeps them together in the tree without putting a
 * segment in the URL.
 *
 * Rendered on demand, like every other data-backed route. The bodies are files
 * in the repository and would happily be static, but `/rules` declares
 * `<LegalSets />` and `<Banlist />` (E17.2, E17.3), which read the format tables
 * — and a pool or a ban baked at build time is exactly the staleness those rows
 * exist to prevent. It is also what lets CI build this app with no database.
 *
 * `generateStaticParams` still enumerates the pages, so `dynamicParams: false`
 * makes an unpublished or unknown slug a 404 rather than a render attempt.
 */
export const dynamic = "force-dynamic";
export const dynamicParams = false;

interface Params {
  readonly params: Promise<{ readonly slug: readonly string[] }>;
}

export function generateStaticParams(): { slug: string[] }[] {
  return publishedInfoPages().map((page) => ({ slug: [...page.slug] }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const page = findInfoPage((await params).slug);
  if (page === null) return {};
  return { title: page.frontmatter.title, description: page.frontmatter.description };
}

export default async function InfoPageRoute({ params }: Params) {
  const page = findInfoPage((await params).slug);
  if (page === null || !page.frontmatter.published) notFound();

  const content = await renderInfoPage({
    body: page.body,
    components: page.frontmatter.components,
  });

  return (
    <Container className="py-12">
      <header className="mb-8 max-w-prose">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {page.frontmatter.title}
        </h1>
        <p className="mt-2 text-ink-600 dark:text-ink-400">{page.frontmatter.description}</p>
      </header>
      {content}
    </Container>
  );
}
