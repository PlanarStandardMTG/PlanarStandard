"use server";

import type { PlayerId, PlayerMergeId, TournamentId } from "@ps/contracts";
import { getProfileByHandle, listTournamentsByIds, setPlayerProfile } from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/guard";
import { mergePlayers, undoMerge } from "@/lib/identity/merge-players.server";
import { createServiceRoleClient } from "@/lib/supabase/service-role.server";

/**
 * The merge grid's two levers (E20.16). Admin only, checked here; the merge
 * itself runs with the service-role client because it moves decks and
 * standings (E18.16).
 */

export async function mergeSelected(form: FormData): Promise<void> {
  const viewer = await requireRole("admin");
  const keep = (form.get("keep")?.toString() ?? "") as PlayerId;
  const others = form
    .getAll("merge")
    .map((value) => value.toString() as PlayerId)
    .filter((id) => id !== keep);
  const reason = form.get("reason")?.toString().trim() || null;
  const search = form.get("q")?.toString() ?? "";
  const back = (params: Record<string, string>) =>
    redirect(
      `/admin/players?${new URLSearchParams({ ...(search === "" ? {} : { q: search }), ...params })}`,
    );

  if (keep === "" || others.length === 0) back({ error: "pick" });

  const service = createServiceRoleClient();
  let merged = 0;
  for (const loserId of others) {
    const outcome = await mergePlayers(service, {
      winnerId: keep,
      loserId,
      reason,
      mergedBy: viewer.profile.id,
    });
    if (!outcome.ok) {
      revalidatePath("/admin/players");
      revalidatePath("/leaderboard");
      back({
        error: outcome.reason,
        merged: String(merged),
        ...(outcome.reason === "played-each-other"
          ? { events: await eventNames(outcome.tournaments) }
          : {}),
      });
    }
    merged += 1;
  }

  revalidatePath("/admin/players");
  revalidatePath("/leaderboard");
  back({ done: "merged", merged: String(merged) });
}

export async function undoMergeAction(form: FormData): Promise<void> {
  const viewer = await requireRole("admin");
  const id = (form.get("id")?.toString() ?? "") as PlayerMergeId;

  const outcome = await undoMerge(createServiceRoleClient(), id, viewer.profile.id);
  revalidatePath("/admin/players");
  revalidatePath("/leaderboard");
  redirect(`/admin/players?${outcome.ok ? "done=undone" : `error=${outcome.reason}`}`);
}

/** Say which member a player is (E20.39), or that none is. */
export async function linkMember(form: FormData): Promise<void> {
  await requireRole("admin");
  const playerId = (form.get("player")?.toString() ?? "") as PlayerId;
  const handle = form.get("handle")?.toString().trim().replace(/^@/, "") ?? "";
  const search = form.get("q")?.toString() ?? "";
  const back = (params: Record<string, string>) =>
    redirect(
      `/admin/players?${new URLSearchParams({ ...(search === "" ? {} : { q: search }), ...params })}`,
    );

  const service = createServiceRoleClient();
  const profile = handle === "" ? null : await getProfileByHandle(service, handle);
  if (handle !== "" && profile === null) back({ error: "no-member" });
  try {
    await setPlayerProfile(service, playerId, profile?.id ?? null);
  } catch (error) {
    if (error instanceof Error && /players_profile_id_key/.test(error.message)) {
      back({ error: "member-taken" });
    }
    throw error;
  }
  revalidatePath("/admin/players");
  back({ done: profile === null ? "unlinked" : "linked" });
}

async function eventNames(ids: readonly TournamentId[]): Promise<string> {
  const events = await listTournamentsByIds(createServiceRoleClient(), ids);
  return events.map((event) => event.name).join(" · ");
}
