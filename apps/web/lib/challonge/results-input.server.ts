import type { RawInput } from "@ps/contracts";
import { knownHandlesForNames, normalizeHandle } from "@ps/core";
import { listIdentitiesByNormalized } from "@ps/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getMatches,
  getParticipants,
  getTournament,
  type ChallongeParticipant,
} from "./results.server";

/**
 * One Challonge event's results as the `adapters/challonge-api` input (E12.14):
 * the three scrubbed fetches in one tagged JSON document. Built from the `get…`
 * functions, so the document never holds more than a Challonge id, a username or
 * a result.
 *
 * A participant an organiser added by name, with no account, goes in under the
 * handle the site already knows that name as (E12.15), or with none, in which
 * case the adapter gives them a stand-in. The typed name itself is never written.
 */
export type ChallongeResultsInput =
  | { readonly status: "ok"; readonly input: RawInput }
  | { readonly status: "not-configured" }
  | { readonly status: "failed"; readonly error: string };

export async function fetchChallongeResultsInput(
  service: SupabaseClient,
  tournamentId: string,
): Promise<ChallongeResultsInput> {
  const tournament = await getTournament(tournamentId);
  if (tournament.status !== "ok") return tournament;
  const participants = await getParticipants(tournamentId);
  if (participants.status !== "ok") return participants;
  const matches = await getMatches(tournamentId);
  if (matches.status !== "ok") return matches;

  const text = JSON.stringify({
    adapter: "challonge-api",
    tournament: tournament.value,
    participants: await withKnownHandles(service, participants.value),
    matches: matches.value,
  });
  return {
    status: "ok",
    input: {
      fileName: `challonge-${tournamentId}.json`,
      bytes: new TextEncoder().encode(text),
      text,
    },
  };
}

async function withKnownHandles(
  service: SupabaseClient,
  participants: readonly ChallongeParticipant[],
) {
  const handles = participants.flatMap((p) => (p.username === null ? [] : [p.username]));
  const names = new Map(
    participants.flatMap((p) => (p.typedName === null ? [] : [[p.id, p.typedName] as const])),
  );
  const known =
    names.size === 0
      ? []
      : await listIdentitiesByNormalized(
          service,
          [...handles, ...names.values()].map(normalizeHandle),
        );
  const knownAs = knownHandlesForNames("challonge", handles, names, known);

  return participants.map(({ id, username, finalRank }) => ({
    id,
    username,
    knownAs: knownAs.get(id) ?? null,
    finalRank,
  }));
}
