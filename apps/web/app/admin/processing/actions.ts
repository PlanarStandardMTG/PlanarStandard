"use server";

import { parseCsv } from "@ps/adapters";
import type { EventSource, TournamentId } from "@ps/contracts";
import { readDecklistSheet } from "@ps/core";
import {
  getSourcedTournament,
  listNamedEntries,
  listTournamentsByIds,
  requeueAllCompletions,
  setCompletionLine,
  setSourcedTournamentRated,
  type CompletionLine,
} from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { UploadState } from "@/components/processing/decklist-upload-form";
import { attachEventDecks, detachEventDecks } from "@/lib/decks/attach-event-decks.server";
import { onFullRerun } from "@/lib/events/on-tournament-completed.server";
import { processCompletedEvents } from "@/lib/events/process-completions.server";
import { requireRole } from "@/lib/auth/guard";
import { RERUN_CONFIRMATION } from "@/lib/jobs/rerun-confirmation";
import { recomputeRatings } from "@/lib/ratings/recompute-ratings.server";
import { createServiceRoleClient } from "@/lib/supabase/service-role.server";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * The admin's levers on the queue of finished tournaments (E23.13, E18.22). The
 * scheduled runner and "process now" are the same pass, so pressing the button
 * while a cron is running is safe — the queue's lease keeps them apart.
 */

export async function processNow(): Promise<never> {
  await requireRole("admin");
  const report = await processCompletedEvents();

  revalidatePath("/admin", "layout");
  redirect(
    `/admin/processing?done=processed&processed=${report.processed}&failed=${report.failed.length}`,
  );
}

export async function rerunEverything(form: FormData): Promise<never> {
  await requireRole("admin");
  if (form.get("confirm")?.toString().trim().toLowerCase() !== RERUN_CONFIRMATION) {
    redirect("/admin/processing?error=confirm");
  }

  await onFullRerun();
  const waiting = await requeueAllCompletions(await createSessionClient());

  revalidatePath("/admin", "layout");
  redirect(`/admin/processing?done=requeued&waiting=${waiting}`);
}

export interface EventKey {
  readonly source: EventSource;
  readonly externalId: string;
}

/** Choose a line for an event that has not been processed yet. */
export async function chooseLine(event: EventKey, line: CompletionLine, on: boolean) {
  await requireRole("admin");
  await setCompletionLine(await createSessionClient(), event, line, on);
  revalidatePath("/admin/processing");
}

/**
 * Take a processed event off a line, undoing it: off the Elo line it is
 * unrated and the whole ladder replays without it (ADR 004); off the decklist
 * line its lists leave its standings, and nothing else needs rebuilding.
 */
export async function leaveLine(event: EventKey, line: CompletionLine) {
  await requireRole("admin");
  await setCompletionLine(await createSessionClient(), event, line, "leave");

  const service = createServiceRoleClient();
  if (line === "elo") {
    await setSourcedTournamentRated(service, event, false);
    await recomputeRatings(service, `unrated:${event.source}:${event.externalId}`);
  } else {
    const tournament = await getSourcedTournament(service, event);
    if (tournament !== null) await detachEventDecks(service, tournament);
  }
  revalidatePath("/", "layout");
}

/**
 * An admin's sheet of decklists onto one event's standings (E20.37), matched
 * to members' saved decks as the decklist line does it.
 */
export async function uploadDecklists(
  _previous: UploadState,
  form: FormData,
): Promise<UploadState> {
  await requireRole("admin");
  const file = form.get("file");
  const text =
    file instanceof File && file.size > 0 ? await file.text() : (form.get("csv")?.toString() ?? "");
  if (text.trim() === "") return { attached: 0, unchanged: 0, issues: ["Choose a CSV file."] };

  const service = createServiceRoleClient();
  const [tournament] = await listTournamentsByIds(service, [
    form.get("tournament")?.toString() as TournamentId,
  ]);
  if (tournament === undefined) {
    return { attached: 0, unchanged: 0, issues: ["That tournament no longer exists."] };
  }

  const sheet = readDecklistSheet(
    parseCsv(text).rows,
    await listNamedEntries(service, [tournament.id]),
  );
  const report = await attachEventDecks(service, tournament, sheet.decks, "organizer");

  revalidatePath("/", "layout");
  return {
    attached: report.attached,
    unchanged: report.unchanged,
    issues: [
      ...sheet.issues.map((issue) => `Row ${issue.row}: ${issue.message}`),
      ...report.problems,
    ],
  };
}
