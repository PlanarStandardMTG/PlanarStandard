import type {
  IdentityId,
  IdentityPlatform,
  IdentityRef,
  ParseIssue,
  PlayerId,
} from "@ps/contracts";
import { normalizeHandle, playerSlug, resolveHandles } from "@ps/core";
import { addIdentity, createPlayerWithIdentity, listIdentitiesByNormalized } from "@ps/db";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * An event's handles → the identities its matches will reference (E18.3).
 * `core/identity/resolve-handles` decides; this carries the decision out.
 *
 * A handle with an `error` issue is absent from `identities`, and the caller must
 * not commit a match that names it.
 */
export interface EventIdentities {
  readonly identities: ReadonlyMap<string, IdentityId>;
  /** Each resolved handle's player, for the standings (E18.21). */
  readonly players: ReadonlyMap<string, PlayerId>;
  readonly issues: readonly ParseIssue[];
}

/** A handle is one word or so; this many collisions means something else is wrong. */
const MAX_SLUG_ATTEMPTS = 20;

export async function resolveEventHandles(
  service: SupabaseClient,
  platform: IdentityPlatform,
  handles: readonly string[],
): Promise<EventIdentities> {
  const known = await listIdentitiesByNormalized(service, handles.map(normalizeHandle));
  const { resolutions, issues } = resolveHandles(platform, handles, known);

  const owners = new Map(known.map((ref) => [ref.id, ref.playerId]));
  const identities = new Map<string, IdentityId>();
  const players = new Map<string, PlayerId>();
  for (const resolution of resolutions) {
    const { handle } = resolution;
    const identity: Pick<IdentityRef, "id" | "playerId"> =
      resolution.kind === "existing"
        ? { id: resolution.identityId, playerId: owners.get(resolution.identityId) as PlayerId }
        : resolution.kind === "attach"
          ? await addIdentity(service, resolution.playerId, {
              platform,
              handle,
              source: "import_inferred",
            })
          : await createPlayer(service, platform, handle);
    identities.set(handle, identity.id);
    players.set(handle, identity.playerId);
  }

  return { identities, players, issues };
}

async function createPlayer(
  service: SupabaseClient,
  platform: IdentityPlatform,
  handle: string,
): Promise<IdentityRef> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await createPlayerWithIdentity(service, {
        displayName: handle,
        slug: playerSlug(handle, attempt),
        platform,
        handle,
        source: "import_inferred",
      });
    } catch (error) {
      const slugTaken = error instanceof Error && /players_slug_key/.test(error.message);
      if (!slugTaken || attempt >= MAX_SLUG_ATTEMPTS) throw error;
    }
  }
}
