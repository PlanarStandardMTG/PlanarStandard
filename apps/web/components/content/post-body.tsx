import type { PostKind } from "@ps/contracts";
import type { ComponentPropsWithoutRef, ReactElement } from "react";
import ReactMarkdown, { type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";

import { PROSE_MARKDOWN_COMPONENTS, Prose } from "@/components/ui/prose";

import { EmbedBlock } from "./embeds/embed-block";
import { EMBED_LANGUAGE, INLINE_EMBED_PREFIX, prepareEmbeds } from "./embeds/prepare";

/**
 * A post body, rendered from Markdown (ADR 001).
 *
 * Raw HTML stays disabled — `react-markdown` ignores it unless `rehype-raw` is
 * added, and post bodies are written by members, so an embedded `<script>` must
 * never become an executed one.
 *
 * Components (`:::name{…}`, E20.23) arrive as fenced blocks from
 * `prepareEmbeds` and leave as `EmbedBlock`s, which refuse any the post's kind
 * may not place. An inline one arrives as a code span instead.
 */
export function PostBody({ markdown, kind }: { markdown: string; kind: PostKind }) {
  return (
    <Prose>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          ...PROSE_MARKDOWN_COMPONENTS,
          pre: (props) => <Pre {...props} kind={kind} />,
          code: (props) => <Code {...props} kind={kind} />,
        }}
      >
        {prepareEmbeds(markdown)}
      </ReactMarkdown>
    </Prose>
  );
}

function Pre({
  children,
  kind,
  ...rest
}: ComponentPropsWithoutRef<"pre"> & ExtraProps & { kind: PostKind }) {
  // react-markdown's syntax-tree node is not a DOM attribute.
  const { node, ...props } = rest;
  void node;

  const code = children as ReactElement<{ className?: string; children?: unknown }> | undefined;
  if (code?.props.className === `language-${EMBED_LANGUAGE}`) {
    return <EmbedBlock source={String(code.props.children ?? "").trim()} kind={kind} />;
  }
  return <pre {...props}>{children}</pre>;
}

function Code({
  children,
  kind,
  ...rest
}: ComponentPropsWithoutRef<"code"> & ExtraProps & { kind: PostKind }) {
  const { node, ...props } = rest;
  void node;

  // A fenced component never reaches here: `Pre` takes it whole.
  if (typeof children === "string" && children.startsWith(INLINE_EMBED_PREFIX)) {
    return <EmbedBlock source={children.slice(INLINE_EMBED_PREFIX.length)} kind={kind} inline />;
  }
  return <code {...props}>{children}</code>;
}
