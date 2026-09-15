import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Prose } from "@/components/ui/prose";

/**
 * A post body, rendered from Markdown (ADR 001).
 *
 * Raw HTML stays disabled — `react-markdown` ignores it unless `rehype-raw` is
 * added, and post bodies are written by members, so an embedded `<script>` must
 * never become an executed one.
 */
export function PostBody({ markdown }: { markdown: string }) {
  return (
    <Prose>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </Prose>
  );
}
