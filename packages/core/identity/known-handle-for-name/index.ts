import type { IdentityPlatform, IdentityRef, PlayerId } from "@ps/contracts";

import { normalizeHandle } from "../normalize-handle/index";
import { resolveHandles, type HandleResolution } from "../resolve-handles/index";

/**
 * The handle to record each account-less entrant under, from the name an
 * organiser typed for them (E12.15) — only when it is already a known handle.
 *
 * The same exact normalized match an import makes (`resolve-handles`), and no
 * fuzzier. A name that matches nobody, several players, or a player already in
 * the event, or that collides with another entrant's, gets nothing: the caller
 * keeps its stand-in for an admin to merge. What comes back is the known
 * identity's own spelling, so the typed name itself is never recorded.
 */
export function knownHandlesForNames(
  platform: IdentityPlatform,
  handles: readonly string[],
  names: ReadonlyMap<string, string>,
  known: readonly IdentityRef[],
): ReadonlyMap<string, string> {
  const seen = new Map<string, number>();
  for (const text of [...handles, ...names.values()]) {
    const normalized = normalizeHandle(text);
    seen.set(normalized, (seen.get(normalized) ?? 0) + 1);
  }

  const { resolutions } = resolveHandles(platform, [...new Set(handles)], known);
  const present = new Set(resolutions.flatMap((resolution) => playerOf(resolution, known)));

  const claims = new Map<PlayerId, { key: string; handle: string }[]>();
  for (const [key, name] of names) {
    const normalized = normalizeHandle(name);
    if (normalized === "" || seen.get(normalized) !== 1) continue;

    const matches = known.filter((identity) => identity.handle.normalized === normalized);
    const match =
      matches.find((identity) => identity.handle.platform === platform) ??
      (new Set(matches.map((identity) => identity.playerId)).size === 1 ? matches[0] : undefined);
    if (match === undefined || present.has(match.playerId)) continue;

    claims.set(match.playerId, [
      ...(claims.get(match.playerId) ?? []),
      { key, handle: match.handle.raw },
    ]);
  }

  // Two entrants who both name one player are two people; neither is them for certain.
  return new Map(
    [...claims.values()].flatMap(([only, ...others]) =>
      only === undefined || others.length > 0 ? [] : [[only.key, only.handle] as const],
    ),
  );
}

function playerOf(resolution: HandleResolution, known: readonly IdentityRef[]): PlayerId[] {
  if (resolution.kind === "attach") return [resolution.playerId];
  if (resolution.kind === "create") return [];
  const owner = known.find((identity) => identity.id === resolution.identityId);
  return owner === undefined ? [] : [owner.playerId];
}
