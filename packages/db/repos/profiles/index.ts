import type { Profile, ProfileId, UserRole } from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import { PROFILE_COLUMNS, toProfile, type ProfileRow } from "./rows";

/**
 * Reads and writes over `profiles` (E16.4).
 *
 * Nothing here creates a profile. That is migration 0016's trigger on
 * `auth.users`, so a row exists before any request could ask for one — these
 * functions may assume that a signed-in visitor has one.
 *
 * `updateProfile` never writes `role`. A person may rename themselves;
 * granting a role is an admin action with its own policy (E14.4), and leaving
 * the column out of the update is what makes that true in the repository as
 * well as in RLS.
 */

/** One profile by auth id. Null when there is no such person. */
export async function getProfile(client: SupabaseClient, id: ProfileId): Promise<Profile | null> {
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

/**
 * The profile behind an auth account (E16.10).
 *
 * Not `getProfile`. Since erasure, `profiles.id` is the profile's own identity
 * and `user_id` is the live link to an account — a tombstone keeps the first and
 * has none of the second. Looking somebody up by the id in their token has to go
 * through `user_id`, or an erased profile would answer for an account that no
 * longer exists.
 */
export async function getProfileByUserId(
  client: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error !== null) throw new Error(`getProfileByUserId failed: ${error.message}`);
  return data === null ? null : toProfile(data as unknown as ProfileRow);
}

/**
 * Erase the caller, irreversibly.
 *
 * Runs under the caller's own client, and the function it calls takes no
 * argument — the subject is `auth.uid()`, read from the token inside the
 * database. There is nothing here to point at somebody else, which is the
 * property worth having: it holds whether or not the route handler above is
 * correct.
 */
export async function eraseOwnProfile(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc("erase_own_profile");
  if (error !== null) throw new Error(`eraseOwnProfile failed: ${error.message}`);
}

/**
 * Every member with an account, for the admin users page (E14.7).
 *
 * Tombstones are left out: there is nobody behind one to promote or ban.
 * Highest role first, then by name, so the people who can do the most are the
 * first thing an admin reviews.
 */
export async function listMembers(client: SupabaseClient): Promise<readonly Profile[]> {
  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .is("deleted_at", null)
    .order("role", { ascending: false })
    .order("display_name", { ascending: true });

  if (error !== null) throw new Error(`listMembers failed: ${error.message}`);
  return (data as unknown as ProfileRow[]).map(toProfile);
}

/**
 * Grant a role. Under the admin's own client, so `profiles_admin_update` decides
 * — including that nobody changes their own. A refusal matches no row, which
 * `.single()` reports as an error rather than a silent no-op.
 */
export async function setMemberRole(
  client: SupabaseClient,
  id: ProfileId,
  role: UserRole,
): Promise<Profile> {
  const { data, error } = await client
    .from("profiles")
    .update({ role })
    .eq("id", id)
    .select(PROFILE_COLUMNS)
    .single();

  if (error !== null) throw new Error(`setMemberRole failed: ${error.message}`);
  return toProfile(data as unknown as ProfileRow);
}

/** Ban or lift a ban. Same policy, same refusal, as `setMemberRole`. */
export async function setMemberBanned(
  client: SupabaseClient,
  id: ProfileId,
  banned: boolean,
): Promise<Profile> {
  const { data, error } = await client
    .from("profiles")
    .update({ banned_at: banned ? new Date().toISOString() : null })
    .eq("id", id)
    .select(PROFILE_COLUMNS)
    .single();

  if (error !== null) throw new Error(`setMemberBanned failed: ${error.message}`);
  return toProfile(data as unknown as ProfileRow);
}
