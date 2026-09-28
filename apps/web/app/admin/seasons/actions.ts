"use server";

import type { SeasonId } from "@ps/contracts";
import { checkSeasonDraft } from "@ps/core";
import { listSeasons, saveSeason as saveSeasonRow } from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { SeasonSaveState } from "@/components/seasons/season-form";
import { requireRole } from "@/lib/auth/guard";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Create and edit seasons (E20.35). Written with the admin's own client, so
 * `seasons_admin_write` checks the role again underneath. Seasons do not
 * decide what Elo rates — its dates are set at `/admin/processing` (E25.6) — so
 * a save leaves the ladder alone.
 */

export async function saveSeason(
  _previous: SeasonSaveState,
  form: FormData,
): Promise<SeasonSaveState> {
  await requireRole("admin");
  const text = (name: string) => form.get(name)?.toString() ?? "";
  const id = text("id") === "" ? null : (text("id") as SeasonId);

  const session = await createSessionClient();
  const others = (await listSeasons(session)).filter((season) => season.id !== id);
  const check = checkSeasonDraft(
    {
      name: text("name"),
      startsOn: text("starts_on"),
      endsOn: text("ends_on"),
      isCurrent: form.get("is_current") === "on",
    },
    others,
  );
  if (!check.ok) return { problems: check.problems };

  await saveSeasonRow(session, id, check.value);

  revalidatePath("/admin/seasons");
  revalidatePath("/leaderboard");
  redirect(`/admin/seasons?done=${id === null ? "created" : "saved"}`);
}
