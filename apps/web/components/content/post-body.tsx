import type { ComponentPropsWithoutRef, ReactElement } from "react";
import ReactMarkdown, { type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";

import { PROSE_MARKDOWN_COMPONENTS, Prose } from "@/components/ui/prose";

import { EmbedBlock } from "./embeds/embed-block";
import { EMBED_LANGUAGE, prepareEmbeds } from "./embeds/prepare";

/**
 * A post body, rendered from Markdown (ADR 001).
 *
 * Raw HTML stays disabled — `react-markdown` ignores it unless `rehype-raw` is
 * added, and post bodies are written by members, so an embedded `<script>` must
 * never become an executed one.
 *
 * Components (`:::name{…}`, E20.23) arrive as fenced blocks from
 * `prepareEmbeds` and leave as `EmbedBlock`s.
 */
export function PostBody({ markdown }: { markdown: string }) {
  return (
    <Prose>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ ...PROSE_MARKDOWN_COMPONENTS, pre: Pre }}
      >
        {prepareEmbeds(markdown)}
      </ReactMarkdown>
    </Prose>
  );
}

function Pre({ children, ...rest }: ComponentPropsWithoutRef<"pre"> & ExtraProps) {
  // react-markdown's syntax-tree node is not a DOM attribute.
  const { node, ...props } = rest;
  void node;

  const code = children as ReactElement<{ className?: string; children?: unknown }> | undefined;
  if (code?.props.className === `language-${EMBED_LANGUAGE}`) {
    return <EmbedBlock source={String(code.props.children ?? "").trim()} />;
  }
  return <pre {...props}>{children}</pre>;
}
