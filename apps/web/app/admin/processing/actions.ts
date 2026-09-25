"use server";

import { requeueAllCompletions } from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { onFullRerun } from "@/lib/events/on-tournament-completed.server";
import { processCompletedEvents } from "@/lib/events/process-completions.server";
import { requireRole } from "@/lib/auth/guard";
import { RERUN_CONFIRMATION } from "@/lib/jobs/rerun-confirmation";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * The admin's two levers on the queue of finished tournaments (E23.13). The
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
