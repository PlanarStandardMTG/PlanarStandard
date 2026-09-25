import type { RawInput } from "@ps/contracts";

import { getTournament, getTournamentDecklists, getTournamentMatches } from "./results.server";

/**
 * One melee.gg event's results as the `adapters/melee-api` input (E12.10): the
 * three scrubbed fetches in one tagged JSON document. Built from the `get…`
 * functions, so nothing here ever holds more than a melee id, a username, a
 * result or a card.
 */
export type MeleeResultsInput =
  | { readonly status: "ok"; readonly input: RawInput }
  | { readonly status: "not-configured" }
  | { readonly status: "failed"; readonly error: string };

export async function fetchMeleeResultsInput(tournamentId: number): Promise<MeleeResultsInput> {
  const tournament = await getTournament(tournamentId);
  if (tournament.status !== "ok") return tournament;
  const matches = await getTournamentMatches(tournamentId);
  if (matches.status !== "ok") return matches;
  const decklists = await getTournamentDecklists(tournamentId);
  if (decklists.status !== "ok") return decklists;

  const text = JSON.stringify({
    adapter: "melee-api",
    tournament: tournament.value,
    matches: matches.value,
    decklists: decklists.value,
  });
  return {
    status: "ok",
    input: { fileName: `melee-${tournamentId}.json`, bytes: new TextEncoder().encode(text), text },
  };
}
