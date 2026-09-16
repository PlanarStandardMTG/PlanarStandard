import type { Profile, ProfileId } from "@ps/contracts";
import { getProfile } from "@ps/db";
import { cache } from "react";

import { createSessionClient } from "@/lib/supabase/session";

/**
 * Who is asking (E16.4).
 *
 * The one place the site turns a session cookie into a person. Everything that
 * needs to know whether someone is signed in, and what they may do, starts
 * here — including the route guards in `guard.ts`.
 */
export interface Viewer {
  readonly profile: Profile;
  /** From `auth.users`, not `profiles`: an address is not a public byline. */
  readonly email: string | null;
}

/**
 * The signed-in visitor, or null.
 *
 * Memoised for the length of one request, because the header and the page both
 * ask and neither should pay for the other's answer.
 */
export const currentViewer = cache(async (): Promise<Viewer | null> => {
  // Nobody is signed in on a machine with no Supabase to be signed in to. CI
  // builds the app with no environment at all (E16.7), and the header asks this
  // question on every route — so an unconfigured site renders signed-out rather
  // than failing to render.
  if (process.env["NEXT_PUBLIC_SUPABASE_URL"] === undefined) return null;

  const supabase = await createSessionClient();

  // `getUser` and not `getSession`. `getSession` reads the cookie and believes
  // it; this revalidates the token with the auth server. On a page that decides
  // what someone may see, the difference is whether a forged cookie is a
  // rejected request or an authenticated one.
  const { data, error } = await supabase.auth.getUser();
  if (error !== null || data.user === null) return null;

  // Created by migration 0016's trigger, so this is never null for a real user.
  // If it ever is, the honest outcome is a 500 rather than a redirect back to a
  // login the visitor has already completed — that loops forever and tells them
  // nothing.
  const profile = await getProfile(supabase, data.user.id as ProfileId);
  if (profile === null) {
    throw new Error(
      `signed-in user ${data.user.id} has no profile row — migration 0016 should have created one`,
    );
  }

  return { profile, email: data.user.email ?? null };
});
