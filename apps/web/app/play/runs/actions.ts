"use server";

import type { RunState } from "@ps/contracts";
import {
  canMoveRun,
  checkContactNames,
  checkRunDetails,
  gamesFromChoice,
  nextCutRound,
  pairSwiss,
  runCutSeeds,
} from "@ps/core";
import {
  addRunGuest,
  confirmRunResult,
  createRun,
  deleteDraftRun,
  dropRunEntrant,
  getDeckWithCards,
  postRunRound,
  registerForRun,
  removeRunEntrant,
  reportRunResult,
  saveRunEntrantDeck,
  setEntrantCheckedIn,
  setRunFormats,
  setRunResult,
  setRunState,
  updateRun,
} from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/guard";
import { loadRun } from "@/lib/runs/load-run";
import { importFinishedRun } from "@/lib/runs/finish-run.server";
import { checkRunDeck } from "@/lib/runs/run-deck";
import {
  notifyResultChased,
  notifyResultReported,
  notifyRoundPaired,
} from "@/lib/runs/run-notices.server";
import { ensureSiteIdentity } from "@/lib/runs/site-identity.server";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Creating, editing and moving a run (E26.16). Every write goes through the caller's
 * own client, so the run policies have the last word; the checks here exist to say
 * why something was refused. Outcomes travel as codes, never as sentences.
 */

function readDetails(form: FormData) {
  const startsAt = form.get("startsAt")?.toString() ?? "";
  const description = (form.get("description")?.toString() ?? "").trim();
  return {
    name: (form.get("name")?.toString() ?? "").trim(),
    startsAt: startsAt === "" || Number.isNaN(Date.parse(startsAt)) ? null : startsAt,
    description: description === "" ? null : description,
    swissRounds: Number(form.get("swissRounds") ?? NaN),
    topCut: Number(form.get("topCut") ?? NaN),
    formatVersionIds: form.getAll("formatVersionId").map(String),
  };
}

export async function createRunAction(form: FormData): Promise<never> {
  const viewer = await requireRole("organizer");
  const details = readDetails(form);
  const problem = checkRunDetails(details);
  if (problem !== null) redirect(`/play/runs/new?error=${problem}`);

  const run = await createRun(
    await createSessionClient(),
    viewer.profile.id,
    details,
    details.formatVersionIds,
  );
  redirect(`/play/runs/${run.id}`);
}

export async function updateRunAction(form: FormData): Promise<never> {
  await requireRole("organizer");
  const runId = form.get("runId")?.toString() ?? "";
  const client = await createSessionClient();
  const view = await loadRun(client, runId);
  if (view === null) redirect("/play");

  const typed = readDetails(form);
  // Once the run has started its shape is fixed, and the form sends none.
  const started = !["draft", "registration"].includes(view.run.state);
  const details = started
    ? { ...typed, swissRounds: view.run.swissRounds, topCut: view.run.topCut }
    : typed;
  const problem = checkRunDetails(details);
  if (problem !== null) redirect(`/play/runs/${runId}/edit?error=${problem}`);

  await updateRun(client, runId, details);
  await setRunFormats(client, runId, details.formatVersionIds);
  revalidatePath(`/play/runs/${runId}`);
  redirect(`/play/runs/${runId}?done=saved`);
}

/**
 * The moves that are only a state change. Starting locks decks (E26.17) and finishing
 * imports the result (E26.21), so those have actions of their own.
 */
const MOVES: ReadonlySet<string> = new Set(["registration", "cancelled"]);

/** Moves a run to `to` when `core/runs/run-state` allows it. */
export async function moveRunAction(form: FormData): Promise<never> {
  await requireRole("organizer");
  const runId = form.get("runId")?.toString() ?? "";
  const to = form.get("to")?.toString() ?? "";
  if (!MOVES.has(to)) redirect(`/play/runs/${runId}?error=not-a-move`);

  const client = await createSessionClient();
  const view = await loadRun(client, runId);
  if (view === null) redirect("/play");

  const move = canMoveRun(view.run, to as RunState, view.position);
  if (!move.ok) redirect(`/play/runs/${runId}?error=${move.reason}`);

  await setRunState(client, runId, to as RunState);
  revalidatePath(`/play/runs/${runId}`);
  revalidatePath("/play");
  redirect(`/play/runs/${runId}?done=${to}`);
}

export async function deleteDraftRunAction(form: FormData): Promise<never> {
  await requireRole("organizer");
  const runId = form.get("runId")?.toString() ?? "";
  await deleteDraftRun(await createSessionClient(), runId);
  redirect("/play?done=deleted");
}

// ---------------------------------------------------------------------------
// Registration (E26.17)
// ---------------------------------------------------------------------------

/** The list an entrant chose: a saved deck of theirs, or text they pasted. */
async function chosenList(
  client: Awaited<ReturnType<typeof createSessionClient>>,
  ownerId: string,
  form: FormData,
): Promise<{ deckId: string | null; text: string } | null> {
  const deckId = form.get("deckId")?.toString() ?? "";
  if (deckId !== "") {
    const deck = await getDeckWithCards(client, deckId);
    if (deck === null || deck.ownerId !== ownerId || deck.rawImport === null) return null;
    return { deckId, text: deck.rawImport };
  }
  const text = form.get("decklist")?.toString() ?? "";
  return text.trim() === "" ? null : { deckId: null, text };
}

export async function registerAction(form: FormData): Promise<never> {
  const viewer = await requireRole("reader");
  const runId = form.get("runId")?.toString() ?? "";
  const back = `/play/runs/${runId}`;
  const { handle } = viewer.profile;
  if (handle === null) redirect(`${back}?error=no-handle`);

  const client = await createSessionClient();
  const view = await loadRun(client, runId);
  if (view === null) redirect("/play");
  if (view.run.state !== "registration") redirect(`${back}?error=registration-closed`);

  const list = await chosenList(client, viewer.profile.id, form);
  if (list === null) redirect(`${back}?error=deck-empty`);
  const check = await checkRunDeck(list.text, view.run.formatVersionIds);
  if (!check.ok) redirect(`${back}?error=${check.problem}`);

  const identified = await ensureSiteIdentity({ ...viewer.profile, handle });
  if (!identified) redirect(`${back}?error=handle-clash`);

  let entrantId: string;
  try {
    const entrant = await registerForRun(client, runId, {
      profileId: viewer.profile.id,
      displayName: viewer.profile.displayName,
      handle,
    });
    entrantId = entrant.id;
  } catch (cause) {
    if (String(cause).includes("23505")) redirect(`${back}?error=already-registered`);
    throw cause;
  }
  await saveRunEntrantDeck(client, {
    entrantId,
    deckId: list.deckId,
    decklistText: list.text,
    isLegal: check.isLegal,
  });
  revalidatePath(back);
  redirect(`${back}?done=registered`);
}

/** A new list for an entry already made, while registration is open. */
export async function changeDeckAction(form: FormData): Promise<never> {
  const viewer = await requireRole("reader");
  const runId = form.get("runId")?.toString() ?? "";
  const entrantId = form.get("entrantId")?.toString() ?? "";
  const back = `/play/runs/${runId}`;

  const client = await createSessionClient();
  const view = await loadRun(client, runId);
  if (view === null) redirect("/play");
  const list = await chosenList(client, viewer.profile.id, form);
  if (list === null) redirect(`${back}?error=deck-empty`);
  const check = await checkRunDeck(list.text, view.run.formatVersionIds);
  if (!check.ok) redirect(`${back}?error=${check.problem}`);

  try {
    await saveRunEntrantDeck(client, {
      entrantId,
      deckId: list.deckId,
      decklistText: list.text,
      isLegal: check.isLegal,
    });
  } catch (cause) {
    if (String(cause).includes("42501")) redirect(`${back}?error=deck-locked`);
    throw cause;
  }
  revalidatePath(back);
  redirect(`${back}?done=deck`);
}

/** A member withdraws, or the organizer removes someone, before the run starts. */
export async function withdrawAction(form: FormData): Promise<never> {
  await requireRole("reader");
  const runId = form.get("runId")?.toString() ?? "";
  const entrantId = form.get("entrantId")?.toString() ?? "";
  const back = `/play/runs/${runId}`;
  try {
    await removeRunEntrant(await createSessionClient(), entrantId);
  } catch {
    redirect(`${back}?error=not-withdrawable`);
  }
  revalidatePath(back);
  redirect(`${back}?done=withdrawn`);
}

// ---------------------------------------------------------------------------
// Guests, check-in and drops (E26.18)
// ---------------------------------------------------------------------------

/** A guest typed in by the organizer before the run starts, with an optional list. */
export async function addGuestAction(form: FormData): Promise<never> {
  await requireRole("organizer");
  const runId = form.get("runId")?.toString() ?? "";
  const back = `/play/runs/${runId}`;
  const displayName = (form.get("displayName")?.toString() ?? "").trim();
  const arena = checkContactNames({
    arenaUsername: form.get("arenaUsername")?.toString() ?? "",
    discordName: "",
  });
  if (displayName === "" || displayName.length > 60) redirect(`${back}?error=guest-name`);
  if (!arena.ok) redirect(`${back}?error=${arena.problem}`);

  const client = await createSessionClient();
  const view = await loadRun(client, runId);
  if (view === null) redirect("/play");
  if (!["draft", "registration"].includes(view.run.state))
    redirect(`${back}?error=registration-closed`);

  const text = form.get("decklist")?.toString() ?? "";
  const check = text.trim() === "" ? null : await checkRunDeck(text, view.run.formatVersionIds);
  if (check !== null && !check.ok) redirect(`${back}?error=${check.problem}`);

  const guest = await addRunGuest(client, runId, {
    displayName,
    arenaUsername: arena.arenaUsername,
  });
  if (check !== null) {
    await saveRunEntrantDeck(client, {
      entrantId: guest.id,
      deckId: null,
      decklistText: text,
      isLegal: check.isLegal,
    });
  }
  revalidatePath(back);
  redirect(`${back}?done=guest`);
}

export async function checkInAction(form: FormData): Promise<never> {
  await requireRole("organizer");
  const runId = form.get("runId")?.toString() ?? "";
  const back = `/play/runs/${runId}`;
  const client = await createSessionClient();
  const entrantIds = form.getAll("entrantId").map(String);
  const checkedIn = form.get("checkedIn") === "1";
  for (const entrantId of entrantIds) await setEntrantCheckedIn(client, entrantId, checkedIn);
  revalidatePath(back);
  redirect(back);
}

/**
 * Drops an entrant during the run. The drop counts from the next round not yet paired
 * (MTR §2.10); there is no undoing it, since nobody re-enters (§28).
 */
export async function dropAction(form: FormData): Promise<never> {
  await requireRole("organizer");
  const runId = form.get("runId")?.toString() ?? "";
  const entrantId = form.get("entrantId")?.toString() ?? "";
  const back = `/play/runs/${runId}`;
  const client = await createSessionClient();
  const view = await loadRun(client, runId);
  if (view === null) redirect("/play");
  if (!["running", "top_cut"].includes(view.run.state)) redirect(`${back}?error=not-running`);

  await dropRunEntrant(client, entrantId, view.position.nextRound - 1);
  revalidatePath(back);
  redirect(`${back}?done=dropped`);
}

// ---------------------------------------------------------------------------
// Starting and pairing (E26.19)
// ---------------------------------------------------------------------------

/**
 * Starts the run: Swiss when it has Swiss rounds, straight to the cut when it has
 * none. Entries and decks lock with the state (0048, 0052).
 */
export async function startRunAction(form: FormData): Promise<never> {
  await requireRole("organizer");
  const runId = form.get("runId")?.toString() ?? "";
  const back = `/play/runs/${runId}`;
  const client = await createSessionClient();
  const view = await loadRun(client, runId);
  if (view === null) redirect("/play");

  const to = view.run.swissRounds > 0 ? "running" : "top_cut";
  const move = canMoveRun(view.run, to, view.position);
  if (!move.ok) redirect(`${back}?error=${move.reason}`);
  await setRunState(client, runId, to);
  revalidatePath(back);
  revalidatePath("/play");
  redirect(`${back}?done=started`);
}

/**
 * Pairs the next Swiss round, or re-pairs the latest one while nothing in it has a
 * result — which replaces it whole (§28). The same seed and the same field give the
 * same pairings, so a re-pair changes only what a drop or a check-in changed.
 */
export async function pairRoundAction(form: FormData): Promise<never> {
  await requireRole("organizer");
  const runId = form.get("runId")?.toString() ?? "";
  const repair = form.get("repair") === "1";
  const back = `/play/runs/${runId}`;
  const client = await createSessionClient();
  const view = await loadRun(client, runId);
  if (view === null) redirect("/play");
  const { run, entrants, rounds, position } = view;
  if (run.state !== "running") redirect(`${back}?error=not-running`);

  const latest = rounds.at(-1);
  const number = repair ? (latest?.number ?? 1) : position.nextRound;
  if (repair && latest?.kind !== "swiss") redirect(`${back}?error=not-a-move`);
  if (!repair) {
    if (position.swissRoundsPaired >= run.swissRounds) redirect(`${back}?error=swiss-rounds-done`);
    if (position.unconfirmedPairings > 0) redirect(`${back}?error=results-missing`);
  }

  const earlier = position.swissPairings.filter((p) => p.round < number);
  const result = pairSwiss({ entrants, pairings: earlier, seed: run.seed, round: number });
  if (!result.ok) redirect(`${back}?error=${result.reason}`);

  try {
    await postRunRound(client, runId, { number, kind: "swiss" }, result.pairings);
  } catch (cause) {
    if (String(cause).includes("cannot be re-paired")) redirect(`${back}?error=round-has-results`);
    throw cause;
  }
  await notifyRoundPaired(runId, number);
  revalidatePath(back);
  redirect(`${back}?done=${repair ? "repaired" : "paired"}`);
}

// ---------------------------------------------------------------------------
// Results (E26.20)
// ---------------------------------------------------------------------------

/** The pairing a result form names, its round's kind, and which side the caller plays. */
async function pairingFor(form: FormData, profileId: string) {
  const runId = form.get("runId")?.toString() ?? "";
  const pairingId = form.get("pairingId")?.toString() ?? "";
  const client = await createSessionClient();
  const view = await loadRun(client, runId);
  if (view === null) redirect("/play");
  const pairing = view.pairings.find((p) => p.id === pairingId);
  if (pairing === undefined) redirect(`/play/runs/${runId}?error=not-a-move`);
  const mine = view.entrants.find((e) => e.profileId === profileId);
  const side =
    mine === undefined
      ? null
      : mine.id === pairing.p1EntrantId
        ? ("p1" as const)
        : mine.id === pairing.p2EntrantId
          ? ("p2" as const)
          : null;
  const elimination = view.rounds.find((r) => r.id === pairing.roundId)?.kind === "elimination";
  return { client, runId, pairing, side, elimination, back: `/play/runs/${runId}` };
}

/** Rethrows anything but the database refusing the change, which becomes a code. */
function refusedOr(cause: unknown, back: string): never {
  if (String(cause).includes("42501")) redirect(`${back}?error=result-refused`);
  if (String(cause).includes("23514")) redirect(`${back}?error=result-invalid`);
  throw cause;
}

/** A player reports their match. It counts once the other player confirms it. */
export async function reportResultAction(form: FormData): Promise<never> {
  const viewer = await requireRole("reader");
  const { client, runId, pairing, side, elimination, back } = await pairingFor(
    form,
    viewer.profile.id,
  );
  if (side === null) redirect(`${back}?error=result-refused`);
  const games = gamesFromChoice(form.get("result")?.toString() ?? "", side, elimination);
  if (games === null) redirect(`${back}?error=result-invalid`);
  try {
    await reportRunResult(client, pairing.id, games);
  } catch (cause) {
    refusedOr(cause, back);
  }
  await notifyResultReported(runId, pairing.id, viewer.profile.id);
  revalidatePath(back);
  redirect(`${back}?done=reported`);
}

/** The other player agrees with what was reported. */
export async function confirmResultAction(form: FormData): Promise<never> {
  const viewer = await requireRole("reader");
  const { client, pairing, back } = await pairingFor(form, viewer.profile.id);
  try {
    await confirmRunResult(client, pairing.id);
  } catch (cause) {
    refusedOr(cause, back);
  }
  revalidatePath(back);
  redirect(`${back}?done=confirmed`);
}

/**
 * The organizer enters a result, overrules one, or accepts one nobody confirmed. It
 * counts at once; the trigger logs it under their name.
 */
export async function setResultAction(form: FormData): Promise<never> {
  const viewer = await requireRole("organizer");
  const { client, pairing, elimination, back } = await pairingFor(form, viewer.profile.id);
  const accept = form.get("accept") === "1";
  const games = accept
    ? pairing.games
    : gamesFromChoice(form.get("result")?.toString() ?? "", "p1", elimination);
  if (games === null) redirect(`${back}?error=result-invalid`);
  try {
    await setRunResult(client, pairing.id, games);
  } catch (cause) {
    refusedOr(cause, back);
  }
  revalidatePath(back);
  redirect(`${back}?done=result-set`);
}

// ---------------------------------------------------------------------------
// The top cut and finishing (E26.21)
// ---------------------------------------------------------------------------

/**
 * Pairs the cut's next round, moving the run into the cut first when it is still in
 * Swiss. Seeds come from the final Swiss standings and stay fixed once the cut starts.
 */
export async function pairCutRoundAction(form: FormData): Promise<never> {
  await requireRole("organizer");
  const runId = form.get("runId")?.toString() ?? "";
  const back = `/play/runs/${runId}`;
  const client = await createSessionClient();
  const view = await loadRun(client, runId);
  if (view === null) redirect("/play");
  const { run, entrants, standings, position } = view;

  if (run.state === "running") {
    const move = canMoveRun(run, "top_cut", position);
    if (!move.ok) redirect(`${back}?error=${move.reason}`);
    await setRunState(client, runId, "top_cut");
  } else if (run.state !== "top_cut") {
    redirect(`${back}?error=not-a-move`);
  }

  const seeds = runCutSeeds(standings, run.topCut, position.cutPairings);
  const next = nextCutRound({
    seeds,
    entrants,
    pairings: position.cutPairings,
    round: position.nextRound,
  });
  if (next.kind === "results-missing") redirect(`${back}?error=results-missing`);
  if (next.kind === "finished") redirect(`${back}?done=cut-finished`);

  await postRunRound(
    client,
    runId,
    { number: position.nextRound, kind: "elimination" },
    next.pairings,
  );
  await notifyRoundPaired(runId, position.nextRound);
  revalidatePath(back);
  redirect(`${back}?done=paired`);
}

/**
 * Finishes the run and imports it: the first time it creates the run's tournament,
 * and after a correction it supersedes the last import wholesale (§26).
 */
export async function finishRunAction(form: FormData): Promise<never> {
  await requireRole("organizer");
  const runId = form.get("runId")?.toString() ?? "";
  const back = `/play/runs/${runId}`;
  const client = await createSessionClient();
  const view = await loadRun(client, runId);
  if (view === null) redirect("/play");

  if (view.run.state !== "finished") {
    const move = canMoveRun(view.run, "finished", view.position);
    if (!move.ok) redirect(`${back}?error=${move.reason}`);
  } else if (view.position.unconfirmedPairings > 0) {
    redirect(`${back}?error=results-missing`);
  }

  const report = await importFinishedRun(client, view);
  if (view.run.state !== "finished") await setRunState(client, runId, "finished");
  revalidatePath(back);
  revalidatePath("/play");
  revalidatePath(`/tournaments/${report.tournament.slug}`);
  redirect(`${back}?done=${report.written ? "finished" : "unchanged"}`);
}

// ---------------------------------------------------------------------------
// Running the room (E26.27)
// ---------------------------------------------------------------------------

/** Nudges both players of a pairing whose result is still missing, by push. */
export async function chaseResultAction(form: FormData): Promise<never> {
  await requireRole("organizer");
  const runId = form.get("runId")?.toString() ?? "";
  const pairingId = form.get("pairingId")?.toString() ?? "";
  const back = `/play/runs/${runId}`;
  const view = await loadRun(await createSessionClient(), runId);
  if (view === null) redirect("/play");
  const sent = await notifyResultChased(runId, pairingId);
  redirect(`${back}?done=${sent > 0 ? "chased" : "chase-unsent"}`);
}
