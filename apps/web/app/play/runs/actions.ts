"use server";

import type { RunState } from "@ps/contracts";
import { canMoveRun, checkRunDetails } from "@ps/core";
import {
  createRun,
  deleteDraftRun,
  getDeckWithCards,
  registerForRun,
  removeRunEntrant,
  saveRunEntrantDeck,
  setRunFormats,
  setRunState,
  updateRun,
} from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/guard";
import { loadRun } from "@/lib/runs/load-run";
import { checkRunDeck } from "@/lib/runs/run-deck";
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
