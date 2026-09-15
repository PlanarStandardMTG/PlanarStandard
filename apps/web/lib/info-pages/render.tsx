import { compile, run } from "@mdx-js/mdx";
import type { ReactElement } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";

import type { InfoPageComponent } from "@ps/contracts";

import { PROSE_MARKDOWN_COMPONENTS, Prose } from "@/components/ui/prose";

import { type InfoPageComponentRegistry, scopeFor } from "./components";
import { remarkInfoPageWhitelist } from "./whitelist";

/**
 * Compiles and runs one MDX page.
 *
 * `@next/mdx` was the starting point named in §25, but it only handles `.mdx`
 * files that live inside `app/`, and these live in `content/pages/` so they can
 * be reviewed as writing rather than as routes. Compiling here is the same MDX
 * pipeline without the loader, and it is what makes generated nav possible: one
 * reader supplies both the nav and the body, so the two cannot disagree.
 *
 * `registry` is a parameter so a test can render against a fake component
 * without the real one existing.
 */
export async function renderInfoPage({
  body,
  components,
  registry,
}: {
  body: string;
  components?: readonly InfoPageComponent[] | undefined;
  registry?: InfoPageComponentRegistry;
}): Promise<ReactElement> {
  const scope = scopeFor(components, registry);

  const compiled = await compile(body, {
    outputFormat: "function-body",
    development: false,
    // The whitelist runs first: a page is refused before it is compiled, not
    // after it has been handed a scope.
    remarkPlugins: [remarkInfoPageWhitelist(components), remarkGfm],
  });

  const { default: Content } = (await run(compiled, {
    ...jsxRuntime,
    baseUrl: import.meta.url,
  })) as { default: (props: { components: Record<string, unknown> }) => ReactElement };

  return (
    <Prose>
      <Content components={{ ...PROSE_MARKDOWN_COMPONENTS, ...scope }} />
    </Prose>
  );
}
