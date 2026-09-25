import { findEmbeds } from "../embed-syntax/index";
import type { RegisteredEmbed } from "../embed-registry/index";

/**
 * Whether what an author typed can be saved, and whether it can be submitted
 * (E20.2). A draft may be unfinished; a submission may not.
 *
 * Problems are codes, not sentences, so the page decides the wording and a
 * crafted query string cannot put text on it.
 */
export const TITLE_MAX = 120;
export const SUBTITLE_MAX = 160;
export const EXCERPT_MAX = 280;
export const TAGS_MAX = 5;
export const BODY_MAX = 100_000;

export interface PostDraftInput {
  readonly title: string;
  readonly subtitle: string;
  readonly excerpt: string;
  readonly tags: string;
  readonly bodyMarkdown: string;
}

export interface PostDraft {
  readonly title: string;
  readonly subtitle: string | null;
  readonly excerpt: string | null;
  readonly tags: readonly string[];
  readonly bodyMarkdown: string;
}

export type DraftProblem =
  | { readonly field: "title"; readonly code: "empty" | "long" }
  | { readonly field: "subtitle" | "excerpt"; readonly code: "long" }
  | { readonly field: "tags"; readonly code: "many" | "invalid" }
  | { readonly field: "body"; readonly code: "empty" | "long" }
  | {
      readonly field: "body";
      readonly code: "unknown-embed" | "bad-embed";
      readonly detail: string;
    };

export type DraftCheck =
  | { readonly ok: true; readonly draft: PostDraft }
  | { readonly ok: false; readonly problems: readonly DraftProblem[] };

const TAG = /^[a-z0-9][a-z0-9-]{0,29}$/;

export function checkPostDraft(
  input: PostDraftInput,
  intent: "save" | "submit",
  registry: readonly RegisteredEmbed[],
): DraftCheck {
  const title = input.title.trim();
  const subtitle = input.subtitle.trim();
  const excerpt = input.excerpt.trim();
  const bodyMarkdown = input.bodyMarkdown.replace(/\r\n/g, "\n").trimEnd();
  const tags = [
    ...new Set(
      input.tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-"))
        .filter((tag) => tag !== ""),
    ),
  ];

  const problems: DraftProblem[] = [];
  if (title === "") problems.push({ field: "title", code: "empty" });
  if (title.length > TITLE_MAX) problems.push({ field: "title", code: "long" });
  if (subtitle.length > SUBTITLE_MAX) problems.push({ field: "subtitle", code: "long" });
  if (excerpt.length > EXCERPT_MAX) problems.push({ field: "excerpt", code: "long" });
  if (tags.length > TAGS_MAX) problems.push({ field: "tags", code: "many" });
  if (tags.some((tag) => !TAG.test(tag))) problems.push({ field: "tags", code: "invalid" });
  if (bodyMarkdown.length > BODY_MAX) problems.push({ field: "body", code: "long" });

  // A draft may be half-written, components included; what goes to readers may not.
  if (intent === "submit") {
    if (bodyMarkdown.trim() === "") problems.push({ field: "body", code: "empty" });
    problems.push(...embedProblems(bodyMarkdown, registry));
  }

  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    draft: {
      title,
      subtitle: subtitle === "" ? null : subtitle,
      excerpt: excerpt === "" ? null : excerpt,
      tags,
      bodyMarkdown,
    },
  };
}

function embedProblems(markdown: string, registry: readonly RegisteredEmbed[]): DraftProblem[] {
  const byName = new Map(registry.map((embed) => [embed.name, embed]));
  return findEmbeds(markdown).flatMap((call): DraftProblem[] => {
    const embed = byName.get(call.name);
    if (embed === undefined) return [{ field: "body", code: "unknown-embed", detail: call.name }];
    const problem = embed.check(call.attributes);
    return problem === null
      ? []
      : [{ field: "body", code: "bad-embed", detail: `${call.name}: ${problem}` }];
  });
}

/** The URL slug for a title. Empty for a title with no letters or digits. */
export function postSlug(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}
