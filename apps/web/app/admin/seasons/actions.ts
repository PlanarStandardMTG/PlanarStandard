"use server";

import type { SeasonId } from "@ps/contracts";
import { checkSeasonDraft } from "@ps/core";
import { listSeasons, saveSeason as saveSeasonRow } from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { SeasonSaveState } from "@/components/seasons/season-form";
import { requireRole } from "@/lib/auth/guard";
import { recomputeRatings } from "@/lib/ratings/recompute-ratings.server";
import { createServiceRoleClient } from "@/lib/supabase/service-role.server";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Create and edit seasons (E20.35). Written with the admin's own client, so
 * `seasons_admin_write` checks the role again underneath. The ladder is the
 * current season's (E18.12), and a save can change which season that is or
 * which events it holds, so every save recomputes.
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

  const saved = await saveSeasonRow(session, id, check.value);
  await recomputeRatings(createServiceRoleClient(), `season:${saved}`);

  revalidatePath("/admin/seasons");
  revalidatePath("/leaderboard");
  redirect(`/admin/seasons?done=${id === null ? "created" : "saved"}`);
}
