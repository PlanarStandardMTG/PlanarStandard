import type { RawInput } from "@ps/contracts";

import { getMatches, getParticipants, getTournament } from "./results.server";

/**
 * One Challonge event's results as the `adapters/challonge-api` input (E12.14):
 * the three scrubbed fetches in one tagged JSON document. Built from the `get…`
 * functions, so nothing here ever holds more than a Challonge id, a username or
 * a result.
 */
export type ChallongeResultsInput =
  | { readonly status: "ok"; readonly input: RawInput }
  | { readonly status: "not-configured" }
  | { readonly status: "failed"; readonly error: string };

export async function fetchChallongeResultsInput(
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
    participants: participants.value,
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
