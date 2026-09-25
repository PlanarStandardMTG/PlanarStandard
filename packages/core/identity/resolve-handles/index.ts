import type {
  IdentityId,
  IdentityPlatform,
  IdentityRef,
  ParseIssue,
  PlayerId,
} from "@ps/contracts";

import { normalizeHandle } from "../normalize-handle/index";

/**
 * What an import does with each handle an event reported (E18.3, E18.20).
 *
 * The only automatic link is an **exact normalized match**: the same platform's
 * identity first, then one player's identity on another platform. Everything
 * else is a new player, and similarity is left to an admin (E20.16) — the fuzzy
 * signals suggest, they never merge.
 */
export type HandleResolution =
  | { readonly kind: "existing"; readonly handle: string; readonly identityId: IdentityId }
  | { readonly kind: "attach"; readonly handle: string; readonly playerId: PlayerId }
  | { readonly kind: "create"; readonly handle: string };

export interface ResolvedHandles {
  readonly resolutions: readonly HandleResolution[];
  /** An `error` names handles that got no resolution; the import cannot commit them. */
  readonly issues: readonly ParseIssue[];
}

export function resolveHandles(
  platform: IdentityPlatform,
  handles: readonly string[],
  known: readonly IdentityRef[],
): ResolvedHandles {
  const issues: ParseIssue[] = [];
  const byNormalized = new Map<string, string[]>();
  for (const handle of new Set(handles)) {
    const normalized = normalizeHandle(handle);
    byNormalized.set(normalized, [...(byNormalized.get(normalized) ?? []), handle]);
  }

  const resolutions: HandleResolution[] = [];
  for (const [normalized, spellings] of byNormalized) {
    if (normalized === "") {
      issues.push(
        issue("unnormalizable-handle", spellings, "has no letters or digits to match on"),
      );
      continue;
    }
    // Two people in one event who normalize alike would become one identity and
    // play themselves. They were two people, so nothing here may join them.
    if (spellings.length > 1) {
      issues.push(
        issue("colliding-handles", spellings, "normalize to the same handle in one event"),
      );
      continue;
    }

    const handle = spellings[0] as string;
    const matches = known.filter((identity) => identity.handle.normalized === normalized);
    const samePlatform = matches.find((identity) => identity.handle.platform === platform);
    if (samePlatform !== undefined) {
      resolutions.push({ kind: "existing", handle, identityId: samePlatform.id });
      continue;
    }

    const players = [...new Set(matches.map((identity) => identity.playerId))];
    if (players.length === 1) {
      resolutions.push({ kind: "attach", handle, playerId: players[0] as PlayerId });
      continue;
    }
    if (players.length > 1) {
      issues.push({
        code: "ambiguous-handle",
        severity: "warning",
        message: `${handle} matches ${players.length} players on other platforms; recorded as a new player for an admin to merge.`,
      });
    }
    resolutions.push({ kind: "create", handle });
  }

  return { resolutions, issues };
}

function issue(code: string, spellings: readonly string[], problem: string): ParseIssue {
  return {
    code,
    severity: "error",
    message: `${spellings.map((s) => `"${s}"`).join(" and ")} ${problem}.`,
  };
}
