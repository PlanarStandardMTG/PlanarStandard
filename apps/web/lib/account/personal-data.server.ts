import { listDecksByOwner, listPostsByAuthor } from "@ps/db";

import type { Viewer } from "@/lib/auth/viewer";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Everything the site holds about one person, as a file they can keep (E16.11).
 *
 * UK and EU GDPR give a person the right to see their data and to take it
 * elsewhere in a machine-readable form — Articles 15 and 20. One JSON download
 * answers both, and answering it in code rather than by hand means it cannot
 * quietly stop being true.
 *
 * Read through the person's **own** client, not service-role. Every query here is
 * one they are entitled to make, so RLS is a second opinion rather than an
 * obstacle: if a policy would have stopped it, the export should not be doing it
 * either.
 *
 * `notHeldHere` is part of the answer, not an apology. A right of access is only
 * honoured if the person can tell what is missing from what they were given.
 */
export interface PersonalDataExport {
  readonly exportedAt: string;
  readonly account: {
    readonly email: string | null;
    readonly signedUp: string;
  };
  readonly profile: unknown;
  readonly posts: readonly unknown[];
  readonly decks: readonly unknown[];
  readonly notHeldHere: readonly string[];
}

export async function personalDataExport(viewer: Viewer): Promise<PersonalDataExport> {
  const supabase = await createSessionClient();
  const { profile, email } = viewer;

  const [posts, decks] = await Promise.all([
    listPostsByAuthor(supabase, profile.id),
    listDecksByOwner(supabase, profile.id),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    account: { email, signedUp: profile.createdAt },
    profile,
    posts,
    decks,
    notHeldHere: [
      "Tournament results are recorded against the handle you played under, not against this account (ADR 003). They come from the organiser's platform — Challonge or melee.gg — and are published there. Ask us if you want a handle separated from your account.",
      "Sign-in events and the IP addresses they came from are kept by Supabase, our authentication provider, and are not readable from the site. Ask us and we will retrieve them.",
      "Anything you have posted in the community Discord belongs to that server and not to this site.",
    ],
  };
}
