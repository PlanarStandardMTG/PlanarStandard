import type { PostKind, PostStatus, UserRole } from "@ps/contracts";
import {
  EMBED_REGISTRY,
  PLANNED_EMBEDS,
  formatEmbed,
  submissionStatus,
  type PostDraftInput,
} from "@ps/core";

import { PostEditor } from "./post-editor";

/**
 * What the editor is told about the author and the post — the labels that say
 * where a save will land, and the component catalogue flattened to data that
 * can cross into the browser (definitions carry functions; these do not).
 */
export function EditorFor({
  id,
  kind,
  slug,
  status,
  role,
  initial,
}: {
  id: string | null;
  kind: PostKind;
  slug: string;
  status: PostStatus | null;
  role: UserRole;
  initial: PostDraftInput;
}) {
  const direct = submissionStatus(role) === "published";
  const live = status === "published";

  return (
    <PostEditor
      id={id}
      kind={kind}
      slug={slug}
      initial={initial}
      submitLabel={live ? "Save changes" : direct ? "Publish" : "Submit for review"}
      saveLabel={live ? "Save" : "Save draft"}
      statusNote={
        live
          ? "This post is live; saving updates it."
          : status === "review"
            ? "Waiting for review. Saving a draft takes it out of the queue."
            : direct
              ? "Publishing makes it live straight away."
              : "A writer or an admin approves it before it goes live."
      }
      liveComponents={EMBED_REGISTRY.map((embed) => ({
        name: embed.name,
        label: embed.label,
        description: embed.description,
        example: formatEmbed(
          embed.name,
          Object.fromEntries(embed.attributes.map((attribute) => [attribute.name, ""])),
        ),
      }))}
      plannedComponents={PLANNED_EMBEDS}
    />
  );
}
