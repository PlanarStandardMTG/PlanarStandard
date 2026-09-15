import Link from "next/link";
import type { PostWithAuthor } from "@ps/contracts";

import { Container } from "@/components/ui/container";
import { FEED_LABEL, feedHref } from "@/lib/post-url";

import { PostBody } from "./post-body";
import { PostMeta } from "./post-meta";

/** One post, full. Shared by `/news/[slug]` and `/articles/[slug]`. */
export function PostArticle({ post }: { post: PostWithAuthor }) {
  return (
    <Container className="py-12">
      <Link
        href={feedHref(post.kind)}
        className="text-sm text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
      >
        <span aria-hidden="true">←</span> {FEED_LABEL[post.kind]}
      </Link>

      <article className="mt-6">
        <header className="mb-8 border-b border-ink-200 pb-6 dark:border-ink-800">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-balance">
            {post.title}
          </h1>
          {post.subtitle !== null && (
            <p className="mt-2 max-w-prose text-lg text-ink-600 dark:text-ink-400">
              {post.subtitle}
            </p>
          )}
          <PostMeta post={post} className="mt-4" />
        </header>

        <PostBody markdown={post.bodyMarkdown} />

        {post.tags.length > 0 && (
          <ul className="mt-10 flex flex-wrap gap-1.5 border-t border-ink-200 pt-6 dark:border-ink-800">
            {post.tags.map((tag) => (
              <li
                key={tag}
                className="rounded bg-ink-100 px-2 py-0.5 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-400"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </article>
    </Container>
  );
}
