"use server";

import { setEventStartTime } from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/guard";
import { createServiceRoleClient } from "@/lib/supabase/service-role.server";

/**
 * Give a melee.gg event the start time its API leaves out (E23.15), or clear
 * it. The form's time is UTC, as every time on the site is shown.
 */
export async function setStartTime(form: FormData): Promise<never> {
  await requireRole("admin");
  const externalId = form.get("event")?.toString() ?? "";
  const clear = form.get("clear") !== null;
  const value = form.get("startsAt")?.toString() ?? "";

  const startsAt = clear || value === "" ? null : new Date(`${value}Z`);
  if (startsAt !== null && Number.isNaN(startsAt.getTime())) {
    redirect("/admin/events?error=invalid");
  }

  const found = await setEventStartTime(
    createServiceRoleClient(),
    { source: "melee", externalId },
    startsAt === null ? null : startsAt.toISOString(),
  );

  revalidatePath("/", "layout");
  redirect(
    `/admin/events?${found ? `done=${startsAt === null ? "cleared" : "set"}` : "error=missing"}`,
  );
}
