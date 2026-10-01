"use server";

import { parseCsv } from "@ps/adapters";
import type { EventSource, TournamentId } from "@ps/contracts";
import { readDecklistSheet } from "@ps/core";
import {
  listNamedEntries,
  listTournamentsByIds,
  requeueAllCompletions,
  requeueCompletion,
} from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { UploadState } from "@/components/fetching/decklist-upload-form";
import { requireRole } from "@/lib/auth/guard";
import { attachEventDecks } from "@/lib/decks/attach-event-decks.server";
import { processCompletedEvents } from "@/lib/events/process-completions.server";
import { refreshCalendarNow } from "@/lib/events/sync-events.server";
import { REFETCH_CONFIRMATION } from "@/lib/jobs/refetch-confirmation";
import { createServiceRoleClient } from "@/lib/supabase/service-role.server";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * The admin's levers on the fetch queue (E23.13, E25.2). The scheduled runner,
 * "fetch now" and a single re-fetch are the same pass, so pressing a button
 * while a cron is running is safe — the queue's lease keeps them apart.
 */

export async function fetchNow(): Promise<never> {
  await requireRole("admin");
  const report = await processCompletedEvents();

  revalidatePath("/", "layout");
  redirect(
    `/admin/fetching?done=fetched&fetched=${report.processed}&failed=${report.failed.length}`,
  );
}

/**
 * One platform's calendar, now, rather than when its two-hour window next
 * opens (E25.7). What it finds finished joins the queue for "Fetch now".
 */
export async function refreshCalendar(form: FormData): Promise<never> {
  await requireRole("admin");
  const source = form.get("source");
  if (source !== "challonge" && source !== "melee") redirect("/admin/fetching");

  const outcome = await refreshCalendarNow(source);

  revalidatePath("/", "layout");
  const query = new URLSearchParams({ done: "calendar", source, outcome: outcome.status });
  if (outcome.status === "refreshed") {
    query.set("events", String(outcome.events));
    query.set("queued", String(outcome.queued));
  }
  if (outcome.status === "failed") query.set("reason", outcome.error);
  redirect(`/admin/fetching?${query.toString()}`);
}

export async function refetchEverything(form: FormData): Promise<never> {
  await requireRole("admin");
  if (form.get("confirm")?.toString().trim().toLowerCase() !== REFETCH_CONFIRMATION) {
    redirect("/admin/fetching?error=confirm");
  }

  const waiting = await requeueAllCompletions(await createSessionClient());

  revalidatePath("/admin", "layout");
  redirect(`/admin/fetching?done=requeued&waiting=${waiting}`);
}

export interface EventKey {
  readonly source: EventSource;
  readonly externalId: string;
}

/** Fetch one event again, now, and say what came of it. */
export async function refetchEvent(event: EventKey): Promise<string> {
  await requireRole("admin");
  if (!(await requeueCompletion(await createSessionClient(), event))) {
    return "Not in the queue.";
  }

  const report = await processCompletedEvents({ limit: 1, ...event });
  revalidatePath("/", "layout");
  if (report.claimed === 0) return "Another run has it; try again shortly.";
  return report.failed[0]?.error ?? "Fetched.";
}

/**
 * An admin's sheet of decklists onto one event's standings (E20.37), matched
 * to members' saved decks as a fetch does it.
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
  const report = await attachEventDecks(
    service,
    tournament,
    sheet.decks.map(({ archetype, ...deck }) =>
      archetype === undefined ? deck : { ...deck, name: archetype, archetypeRaw: archetype },
    ),
    "organizer",
  );

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
