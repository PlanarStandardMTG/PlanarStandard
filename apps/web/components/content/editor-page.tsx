import type { PostKind, PostStatus, UserRole } from "@ps/contracts";
import { embedsFor, submissionStatus, type PostDraftInput } from "@ps/core";

import type { ProfileId } from "@ps/contracts";
import { listMemberDecks, listTournamentsWithResults } from "@ps/db";

// The preview is JSX from a server action, and a route's client manifest lists
// only the client components its own server tree imports. A decklist in the
// preview needs this one, so the editor's tree imports it.
import "@/components/decks/card-hover-link";
import { createSessionClient } from "@/lib/supabase/session";

import { PostEditor } from "./post-editor";

/** Enough recent events for a picker; an older one can still be typed as a slug by hand. */
const TOURNAMENT_CHOICES = 40;

/**
 * What the editor is told about the author and the post — the labels that say
 * where a save will land, the names of the components this kind of post may
 * place (definitions carry functions, so only names cross into the browser),
 * and the author's decks and recent events for the component pickers.
 */
export async function EditorFor({
  authorId,
  id,
  kind,
  slug,
  status,
  role,
  initial,
}: {
  authorId: ProfileId;
  id: string | null;
  kind: PostKind;
  slug: string;
  status: PostStatus | null;
  role: UserRole;
  initial: PostDraftInput;
}) {
  const direct = submissionStatus(role) === "published";
  const live = status === "published";
  const session = await createSessionClient();
  const [decks, tournaments] = await Promise.all([
    listMemberDecks(session, authorId),
    listTournamentsWithResults(session, TOURNAMENT_CHOICES),
  ]);

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
      components={embedsFor(kind).map((embed) => embed.name)}
      decks={decks.map((deck) => ({ id: deck.id, name: deck.name, visibility: deck.visibility }))}
      tournaments={tournaments.map((t) => ({ slug: t.slug, name: t.name, date: t.eventDate }))}
    />
  );
}
