import type { Profile, ProfileId } from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import { PROFILE_COLUMNS, toProfile, type ProfileRow } from "./rows";

/**
 * Reads and writes over `profiles` (E16.4).
 *
 * Nothing here creates a profile. That is migration 0016's trigger on
 * `auth.users`, so a row exists before any request could ask for one — these
 * functions may assume that a signed-in visitor has one.
 *
 * `role` is readable here and never writable. A person may rename themselves;
 * granting a role is an admin action with its own policy (E14.4), and leaving
 * the column out of the update is what makes that true in the repository as
 * well as in RLS.
 */

/** One profile by auth id. Null when there is no such person. */
export async function getProfile(
  client: SupabaseClient,
  id: ProfileId,
): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error !== null) throw new Error(`getProfile failed: ${error.message}`);
  return data === null ? null : toProfile(data as unknown as ProfileRow);
}

/** One profile by its chosen handle — the public `/players`-style lookup. */
export async function getProfileByHandle(
  client: SupabaseClient,
  handle: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("handle", handle)
    .maybeSingle();

  if (error !== null) throw new Error(`getProfileByHandle failed: ${error.message}`);
  return data === null ? null : toProfile(data as unknown as ProfileRow);
}

/** What a person is allowed to change about themselves. */
export interface ProfileEdit {
  readonly displayName: string;
  readonly handle: string | null;
  readonly bio: string | null;
}

/**
 * Save a person's own edits.
 *
 * Runs under the caller's own client, so `profiles_self_update` is what decides
 * whether this is allowed — the `id` argument is not a permission check and is
 * not treated as one.
 */
export async function updateProfile(
  client: SupabaseClient,
  id: ProfileId,
  edit: ProfileEdit,
): Promise<Profile> {
  const { data, error } = await client
    .from("profiles")
    .update({
      display_name: edit.displayName,
      handle: edit.handle,
      bio: edit.bio,
    })
    .eq("id", id)
    .select(PROFILE_COLUMNS)
    .single();

  if (error !== null) throw new Error(`updateProfile failed: ${error.message}`);
  return toProfile(data as unknown as ProfileRow);
}
