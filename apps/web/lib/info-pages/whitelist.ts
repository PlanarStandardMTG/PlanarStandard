import type { InfoPageComponent } from "@ps/contracts";

/**
 * Refuses, at compile time, any JSX an info page is not allowed to contain.
 *
 * §25 asks for the MDX component set to be whitelisted because MDX executes.
 * The `components` prop cannot do that job: it only intercepts elements MDX
 * derives from Markdown, so a literal `<script>` or `<iframe>` in the body
 * compiles straight to that element and never consults the map. Checking the
 * tree does, and it fails the build rather than the render.
 *
 * Info pages are PR-reviewed, so this is a floor under review rather than a
 * replacement for it. It is worth having because review is a person.
 */

export class DisallowedMdxError extends Error {}

/** A `{/* … *\/}` expression carries no behaviour; anything else in braces runs. */
const COMMENT_ONLY = /^\s*(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*\n?|\s)*$/;

interface Node {
  readonly type: string;
  readonly name?: string | null;
  readonly value?: string;
  readonly children?: readonly Node[];
  readonly attributes?: readonly Node[];
}

function check(node: Node, allowed: ReadonlySet<string>): void {
  switch (node.type) {
    case "mdxJsxFlowElement":
    case "mdxJsxTextElement": {
      const name = node.name ?? "<>";
      if (!allowed.has(name)) {
        const list = allowed.size === 0 ? "none" : [...allowed].sort().join(", ");
        throw new DisallowedMdxError(
          `<${name} /> is not available to this page. Markdown covers the rest; ` +
            `declared components here: ${list}.`,
        );
      }
      break;
    }
    case "mdxFlowExpression":
    case "mdxTextExpression":
      if (!COMMENT_ONLY.test(node.value ?? "")) {
        throw new DisallowedMdxError(
          `expressions in braces are not allowed in an info page: {${(node.value ?? "").trim()}}`,
        );
      }
      break;
    case "mdxjsEsm":
      throw new DisallowedMdxError("`import` and `export` are not allowed in an info page");
    default:
      break;
  }

  for (const child of [...(node.children ?? []), ...(node.attributes ?? [])]) check(child, allowed);
}

/** A remark plugin. `declared` is the page's own frontmatter list, already validated. */
export function remarkInfoPageWhitelist(declared: readonly InfoPageComponent[] | undefined) {
  const allowed = new Set<string>(declared ?? []);
  return () => (tree: Node) => {
    check(tree, allowed);
  };
}
