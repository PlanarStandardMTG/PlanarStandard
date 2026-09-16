import type { Profile, ProfileId, UserRole } from "@ps/contracts";

/** `profiles` as PostgREST returns it. The snake_case shape stops at this file. */
export interface ProfileRow {
  readonly id: string;
  readonly display_name: string;
  readonly handle: string | null;
  readonly avatar_url: string | null;
  readonly bio: string | null;
  readonly role: UserRole;
  readonly created_at: string;
  readonly deleted_at: string | null;
}

export const PROFILE_COLUMNS =
  "id, display_name, handle, avatar_url, bio, role, created_at, deleted_at";

export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id as ProfileId,
    displayName: row.display_name,
    handle: row.handle,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    role: row.role,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}
