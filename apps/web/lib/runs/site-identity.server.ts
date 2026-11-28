import type { Profile } from "@ps/contracts";
import { normalizeHandle, playerSlug } from "@ps/core";
import {
  addIdentity,
  createPlayerWithIdentity,
  findIdentityByNormalizedHandle,
  getPlayerByProfile,
  setPlayerProfile,
} from "@ps/db";

import { createServiceRoleClient } from "@/lib/supabase/service-role.server";

const MAX_SLUG_ATTEMPTS = 20;

/**
 * The member's profile handle as a `site` identity on their player (§28, E26.17), so
 * the matches a finished run imports land on the player their rating already belongs
 * to. A member with no player yet gets one, linked to their profile. Service-role: an
 * identity is a ledger row no member may write.
 *
 * Returns false when the handle is already somebody else's on this platform — two
 * profile handles that normalize alike — which an admin has to sort out.
 */
export async function ensureSiteIdentity(
  profile: Pick<Profile, "id" | "displayName"> & { readonly handle: string },
): Promise<boolean> {
  const service = createServiceRoleClient();
  const existing = await findIdentityByNormalizedHandle(
    service,
    "site",
    normalizeHandle(profile.handle),
  );
  const player = await getPlayerByProfile(service, profile.id);
  if (existing !== null) return player !== null && existing.playerId === player.id;

  if (player !== null) {
    await addIdentity(service, player.id, {
      platform: "site",
      handle: profile.handle,
      source: "member_registered",
    });
    return true;
  }

  for (let attempt = 1; ; attempt++) {
    try {
      const identity = await createPlayerWithIdentity(service, {
        displayName: profile.displayName,
        slug: playerSlug(profile.handle, attempt),
        platform: "site",
        handle: profile.handle,
        source: "member_registered",
      });
      await setPlayerProfile(service, identity.playerId, profile.id);
      return true;
    } catch (error) {
      const slugTaken = error instanceof Error && /players_slug_key/.test(error.message);
      if (!slugTaken || attempt >= MAX_SLUG_ATTEMPTS) throw error;
    }
  }
}
