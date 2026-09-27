"use server";

import type { TournamentId } from "@ps/contracts";
import { applyEloInclusion, listTournamentCoverage, setTournamentInclusion } from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

/** Apply every staged Elo choice, then rebuild the ladder once (ADR 004). */
export async function recomputeNow(): Promise<never> {
  await requireRole("admin");
  const service = createServiceRoleClient();
  const changed = await applyEloInclusion(service);
  await recomputeRatings(service, `processing:${changed}`);

  revalidatePath("/", "layout");
  redirect(`/admin/processing?done=recomputed&changed=${changed}`);
}
