"use server";

import type { FormatVersionId, TournamentId } from "@ps/contracts";
import { parseRatingWindow } from "@ps/core";
import {
  applyEloInclusion,
  listFormatVersions,
  listTournamentCoverage,
  setRatingWindow,
  setTournamentFormat,
  setTournamentInclusion,
} from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { RatingWindowState } from "@/components/processing/rating-window-form";
import { requireRole } from "@/lib/auth/guard";
import { recomputeRatings } from "@/lib/ratings/recompute-ratings.server";
import { createServiceRoleClient } from "@/lib/supabase/service-role.server";

/**
 * What a stored tournament counts towards (E25.3). Nothing here calls an
 * external API: it reads and writes this site's own data.
 */

/**
 * Tick or untick one of a tournament's two boxes. Elo is only staged — see
 * `recomputeNow`. A box needs something to count: Elo an event's matches
 * (ADR 006), card statistics its decklists.
 */
export async function include(id: string, what: "elo" | "cardStats", on: boolean) {
  await requireRole("admin");
  const service = createServiceRoleClient();
  const row = (await listTournamentCoverage(service)).find((r) => r.tournament.id === id);
  if (row === undefined || (what === "elo" ? row.matches : row.decks) === 0) return;

  await setTournamentInclusion(
    service,
    id as TournamentId,
    what === "elo" ? { elo: on } : { cardStats: on },
  );
  revalidatePath("/admin", "layout");
}

/** Put an event, and every deck it made, in another format version (E25.8). */
export async function setEventFormat(id: string, formatVersionId: string) {
  await requireRole("admin");
  const service = createServiceRoleClient();
  const versions = await listFormatVersions(service);
  if (!versions.some((version) => version.id === formatVersionId)) return;

  await setTournamentFormat(service, id as TournamentId, formatVersionId as FormatVersionId);
  revalidatePath("/", "layout");
}

/** Apply every staged Elo choice, then rebuild the ladder once (ADR 004). */
export async function recomputeNow(): Promise<never> {
  await requireRole("admin");
  const service = createServiceRoleClient();
  const changed = await applyEloInclusion(service);
  await recomputeRatings(service, `processing:${changed}`);

  revalidatePath("/", "layout");
  redirect(`/admin/processing?done=recomputed&changed=${changed}`);
}

/**
 * Save the dates Elo replays (E25.6) and rebuild the ladder over them. Staged
 * Elo ticks stay staged: the replay reads what is applied.
 */
export async function saveRatingWindow(
  _previous: RatingWindowState,
  form: FormData,
): Promise<RatingWindowState> {
  await requireRole("admin");
  const parsed = parseRatingWindow(
    form.get("rated_from")?.toString() ?? "",
    form.get("rated_until")?.toString() ?? "",
  );
  if (!parsed.ok) return { error: parsed.error };

  const service = createServiceRoleClient();
  await setRatingWindow(service, parsed.window);
  await recomputeRatings(service, "processing:window");

  revalidatePath("/", "layout");
  redirect("/admin/processing?done=window");
}
