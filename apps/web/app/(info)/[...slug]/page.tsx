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
 * Static, unlike the post routes — the source is files in the repository, so
 * there is nothing to be dynamic about. `dynamicParams: false` means an
 * unpublished or unknown slug is a 404 rather than a render attempt.
 */
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
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{page.frontmatter.title}</h1>
        <p className="mt-2 text-ink-600 dark:text-ink-400">{page.frontmatter.description}</p>
      </header>
      {content}
    </Container>
  );
}
