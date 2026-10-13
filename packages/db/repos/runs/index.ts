import type {
  FormatVersionId,
  PostedRunPairing,
  ProfileId,
  ProposedRunPairing,
  Run,
  RunEntrant,
  RunEntrantDeck,
  RunEntrantId,
  RunGames,
  RunId,
  RunPairingId,
  RunResultChange,
  RunRound,
  RunRoundId,
  RunRoundKind,
  RunState,
  TournamentId,
} from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ENTRANT_COLUMNS,
  ENTRANT_DECK_COLUMNS,
  PAIRING_COLUMNS,
  RESULT_CHANGE_COLUMNS,
  ROUND_COLUMNS,
  RUN_COLUMNS,
  toPostedRunPairing,
  toRun,
  toRunEntrant,
  toRunEntrantDeck,
  toRunResultChange,
  toRunRound,
  type EntrantDeckRow,
  type EntrantRow,
  type PairingRow,
  type ResultChangeRow,
  type RoundRow,
  type RunRow,
} from "./rows";

/**
 * Reads and writes over the run tables (E26.14, §28).
 *
 * Every write runs under the caller's own client: the policies and the result guard
 * in 0048–0049 decide who may do what, and these functions do not second-guess
 * them. The one exception, `linkRunTournament`, takes the service-role client.
 */

function fail(name: string, error: { message: string; code?: string }): never {
  throw new Error(`${name} failed: ${error.message}${error.code ? ` (${error.code})` : ""}`);
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export interface RunDetails {
  readonly name: string;
  readonly startsAt: string | null;
  readonly description: string | null;
  readonly swissRounds: number;
  readonly topCut: number;
}

/** A new draft run under the caller's name. The database chooses its seed. */
export async function createRun(
  client: SupabaseClient,
  organizerId: ProfileId,
  details: RunDetails,
  formatVersionIds: readonly FormatVersionId[],
): Promise<Run> {
  const { data, error } = await client
    .from("tournament_runs")
    .insert({
      name: details.name,
      starts_at: details.startsAt,
      description: details.description,
      organizer_id: organizerId,
      swiss_rounds: details.swissRounds,
      top_cut: details.topCut,
    })
    .select("id")
    .single();
  if (error !== null) fail("createRun", error);
  const id = (data as { id: string }).id;
  await setRunFormats(client, id, formatVersionIds);
  return (
    (await getRun(client, id)) ?? fail("createRun", { message: "the new run is not readable" })
  );
}

export async function updateRun(
  client: SupabaseClient,
  runId: RunId,
  details: RunDetails,
): Promise<void> {
  const { error } = await client
    .from("tournament_runs")
    .update({
      name: details.name,
      starts_at: details.startsAt,
      description: details.description,
      swiss_rounds: details.swissRounds,
      top_cut: details.topCut,
    })
    .eq("id", runId);
  if (error !== null) fail("updateRun", error);
}

/** The run's format versions, in this order; the first is the default. */
export async function setRunFormats(
  client: SupabaseClient,
  runId: RunId,
  formatVersionIds: readonly FormatVersionId[],
): Promise<void> {
  const { error: cleared } = await client
    .from("tournament_run_formats")
    .delete()
    .eq("run_id", runId);
  if (cleared !== null) fail("setRunFormats", cleared);
  if (formatVersionIds.length === 0) return;
  const { error } = await client.from("tournament_run_formats").insert(
    formatVersionIds.map((formatVersionId, i) => ({
      run_id: runId,
      format_version_id: formatVersionId,
      position: i + 1,
    })),
  );
  if (error !== null) fail("setRunFormats", error);
}

/** Moves a run to `state`. Whether the move is allowed is `core/runs/run-state`'s call, made first. */
export async function setRunState(
  client: SupabaseClient,
  runId: RunId,
  state: RunState,
): Promise<void> {
  const { data, error } = await client
    .from("tournament_runs")
    .update({ state })
    .eq("id", runId)
    .select("id");
  if (error !== null) fail("setRunState", error);
  if ((data ?? []).length === 0) fail("setRunState", { message: "no run the caller manages" });
}

/** Deletes a draft. Anything that has been public is cancelled instead. */
export async function deleteDraftRun(client: SupabaseClient, runId: RunId): Promise<void> {
  const { error } = await client.from("tournament_runs").delete().eq("id", runId);
  if (error !== null) fail("deleteDraftRun", error);
}

/** One run, or null when it is unknown or a draft the caller does not manage. */
export async function getRun(client: SupabaseClient, runId: RunId): Promise<Run | null> {
  const { data, error } = await client
    .from("tournament_runs")
    .select(RUN_COLUMNS)
    .eq("id", runId)
    .maybeSingle();
  if (error !== null) fail("getRun", error);
  return data === null ? null : toRun(data as unknown as RunRow);
}

/** An organizer's runs, newest first, drafts included when the caller may see them. */
export async function listRunsByOrganizer(
  client: SupabaseClient,
  organizerId: ProfileId,
): Promise<readonly Run[]> {
  const { data, error } = await client
    .from("tournament_runs")
    .select(RUN_COLUMNS)
    .eq("organizer_id", organizerId)
    .order("created_at", { ascending: false });
  if (error !== null) fail("listRunsByOrganizer", error);
  return (data as unknown as RunRow[]).map(toRun);
}

/** Runs open for registration or being played, soonest first — the schedule and `/play`. */
export async function listLiveRuns(client: SupabaseClient): Promise<readonly Run[]> {
  const { data, error } = await client
    .from("tournament_runs")
    .select(RUN_COLUMNS)
    .in("state", ["registration", "running", "top_cut"])
    .order("starts_at", { ascending: true, nullsFirst: false });
  if (error !== null) fail("listLiveRuns", error);
  return (data as unknown as RunRow[]).map(toRun);
}

/** The tournament a finished run was imported into (E26.21). Service-role: a client may not set it. */
export async function linkRunTournament(
  serviceClient: SupabaseClient,
  runId: RunId,
  tournamentId: TournamentId,
): Promise<void> {
  const { error } = await serviceClient
    .from("tournament_runs")
    .update({ tournament_id: tournamentId })
    .eq("id", runId);
  if (error !== null) fail("linkRunTournament", error);
}

// ---------------------------------------------------------------------------
// Entrants
// ---------------------------------------------------------------------------

export async function listRunEntrants(
  client: SupabaseClient,
  runId: RunId,
): Promise<readonly RunEntrant[]> {
  const { data, error } = await client
    .from("run_entrants")
    .select(ENTRANT_COLUMNS)
    .eq("run_id", runId)
    .order("created_at", { ascending: true });
  if (error !== null) fail("listRunEntrants", error);
  return (data as unknown as EntrantRow[]).map(toRunEntrant);
}

/** The caller registers themself, under the profile handle their matches will carry. */
export async function registerForRun(
  client: SupabaseClient,
  runId: RunId,
  member: { readonly profileId: ProfileId; readonly displayName: string; readonly handle: string },
): Promise<RunEntrant> {
  const { data, error } = await client
    .from("run_entrants")
    .insert({
      run_id: runId,
      profile_id: member.profileId,
      display_name: member.displayName,
      handle: member.handle,
    })
    .select(ENTRANT_COLUMNS)
    .single();
  if (error !== null) fail("registerForRun", error);
  return toRunEntrant(data as unknown as EntrantRow);
}

/** A guest the organizer types in, with the Arena username their opponent will need. */
export async function addRunGuest(
  client: SupabaseClient,
  runId: RunId,
  guest: { readonly displayName: string; readonly arenaUsername: string | null },
): Promise<RunEntrant> {
  const { data, error } = await client
    .from("run_entrants")
    .insert({ run_id: runId, display_name: guest.displayName })
    .select(ENTRANT_COLUMNS)
    .single();
  if (error !== null) fail("addRunGuest", error);
  const entrant = toRunEntrant(data as unknown as EntrantRow);
  if (guest.arenaUsername !== null) {
    const { error: contact } = await client
      .from("run_guest_contacts")
      .insert({ entrant_id: entrant.id, arena_username: guest.arenaUsername });
    if (contact !== null) fail("addRunGuest", contact);
  }
  return entrant;
}

/** A member withdrawing, or the organizer removing someone, before the run starts. */
export async function removeRunEntrant(
  client: SupabaseClient,
  entrantId: RunEntrantId,
): Promise<void> {
  const { data, error } = await client
    .from("run_entrants")
    .delete()
    .eq("id", entrantId)
    .select("id");
  if (error !== null) fail("removeRunEntrant", error);
  if ((data ?? []).length === 0) fail("removeRunEntrant", { message: "not removable now" });
}

export async function setEntrantCheckedIn(
  client: SupabaseClient,
  entrantId: RunEntrantId,
  checkedIn: boolean,
): Promise<void> {
  const { error } = await client
    .from("run_entrants")
    .update({ checked_in: checkedIn })
    .eq("id", entrantId);
  if (error !== null) fail("setEntrantCheckedIn", error);
}

/** Drops an entrant after `afterRound` rounds were paired (MTR §2.10). */
export async function dropRunEntrant(
  client: SupabaseClient,
  entrantId: RunEntrantId,
  afterRound: number,
): Promise<void> {
  const { error } = await client
    .from("run_entrants")
    .update({ dropped_after_round: afterRound })
    .eq("id", entrantId)
    .is("dropped_after_round", null);
  if (error !== null) fail("dropRunEntrant", error);
}

/**
 * The Arena username to send a Direct Challenge to, or null when there is none or the
 * caller may not see it (§28): a member's from their profile, a guest's from the run.
 */
export async function getEntrantArenaUsername(
  client: SupabaseClient,
  entrant: Pick<RunEntrant, "id" | "profileId">,
): Promise<string | null> {
  const { data, error } =
    entrant.profileId === null
      ? await client
          .from("run_guest_contacts")
          .select("arena_username")
          .eq("entrant_id", entrant.id)
          .maybeSingle()
      : await client
          .from("profile_contacts")
          .select("arena_username")
          .eq("profile_id", entrant.profileId)
          .maybeSingle();
  if (error !== null) fail("getEntrantArenaUsername", error);
  return (data as { arena_username: string | null } | null)?.arena_username ?? null;
}

/**
 * Sets an entrant's deck: the entrant while registration is open, the organizer until
 * the run starts. Locked after that for everyone (0052, ADR 013).
 */
export async function saveRunEntrantDeck(
  client: SupabaseClient,
  deck: RunEntrantDeck,
): Promise<void> {
  const { error } = await client.from("run_entrant_decks").upsert({
    entrant_id: deck.entrantId,
    deck_id: deck.deckId,
    decklist_text: deck.decklistText,
    is_legal: deck.isLegal,
  });
  if (error !== null) fail("saveRunEntrantDeck", error);
}

/** The run's decks the caller may read: their own, or every one for its organizer. */
export async function listRunEntrantDecks(
  client: SupabaseClient,
  runId: RunId,
): Promise<readonly RunEntrantDeck[]> {
  const { data, error } = await client
    .from("run_entrant_decks")
    .select(`${ENTRANT_DECK_COLUMNS}, run_entrants!inner(run_id)`)
    .eq("run_entrants.run_id", runId);
  if (error !== null) fail("listRunEntrantDecks", error);
  return (data as unknown as EntrantDeckRow[]).map(toRunEntrantDeck);
}

// ---------------------------------------------------------------------------
// Rounds and pairings
// ---------------------------------------------------------------------------

export async function listRunRounds(
  client: SupabaseClient,
  runId: RunId,
): Promise<readonly RunRound[]> {
  const { data, error } = await client
    .from("run_rounds")
    .select(ROUND_COLUMNS)
    .eq("run_id", runId)
    .order("number", { ascending: true });
  if (error !== null) fail("listRunRounds", error);
  return (data as unknown as RoundRow[]).map(toRunRound);
}

/** Every pairing in the run, round by round and table by table. */
export async function listRunPairings(
  client: SupabaseClient,
  runId: RunId,
): Promise<readonly PostedRunPairing[]> {
  const { data, error } = await client
    .from("run_pairings")
    .select(PAIRING_COLUMNS)
    .eq("run_id", runId);
  if (error !== null) fail("listRunPairings", error);
  return (data as unknown as PairingRow[])
    .map(toPostedRunPairing)
    .sort((a, b) => a.round - b.round || a.table - b.table);
}

/**
 * Posts a round and its pairings in one transaction (0051). Posting a number that
 * already exists re-pairs it, which the database refuses once a result is in.
 */
export async function postRunRound(
  client: SupabaseClient,
  runId: RunId,
  round: { readonly number: number; readonly kind: RunRoundKind },
  pairings: readonly ProposedRunPairing[],
): Promise<RunRoundId> {
  const { data, error } = await client.rpc("post_run_round", {
    p_run_id: runId,
    p_number: round.number,
    p_kind: round.kind,
    p_pairings: pairings,
  });
  if (error !== null) fail("postRunRound", error);
  return data as RunRoundId;
}

async function updatePairing(
  name: string,
  client: SupabaseClient,
  pairingId: RunPairingId,
  values: Record<string, number | string | null>,
): Promise<void> {
  const { data, error } = await client
    .from("run_pairings")
    .update(values)
    .eq("id", pairingId)
    .select("id");
  if (error !== null) fail(name, error);
  if ((data ?? []).length === 0) fail(name, { message: "not a pairing the caller plays or runs" });
}

const gameColumns = (games: RunGames) => ({
  p1_wins: games.p1Wins,
  p2_wins: games.p2Wins,
  draws: games.draws,
});

/** A player reports their match. It counts once the other player confirms it (E26.20). */
export async function reportRunResult(
  client: SupabaseClient,
  pairingId: RunPairingId,
  games: RunGames,
): Promise<void> {
  await updatePairing("reportRunResult", client, pairingId, gameColumns(games));
}

/** The other player agrees with what was reported. */
export async function confirmRunResult(
  client: SupabaseClient,
  pairingId: RunPairingId,
): Promise<void> {
  await updatePairing("confirmRunResult", client, pairingId, { status: "confirmed" });
}

/** The organizer enters or overrules a result; it counts at once. */
export async function setRunResult(
  client: SupabaseClient,
  pairingId: RunPairingId,
  games: RunGames,
): Promise<void> {
  await updatePairing("setRunResult", client, pairingId, {
    ...gameColumns(games),
    status: "confirmed",
  });
}

/** One pairing's result history, oldest first — for the organizer. */
export async function listRunResultChanges(
  client: SupabaseClient,
  pairingId: RunPairingId,
): Promise<readonly RunResultChange[]> {
  const { data, error } = await client
    .from("run_result_changes")
    .select(RESULT_CHANGE_COLUMNS)
    .eq("pairing_id", pairingId)
    .order("created_at", { ascending: true });
  if (error !== null) fail("listRunResultChanges", error);
  return (data as unknown as ResultChangeRow[]).map(toRunResultChange);
}
