"use server";

import type { FormatVersionId, OracleId, TournamentId } from "@ps/contracts";
import { parseRatingWindow } from "@ps/core";
import {
  applyEloInclusion,
  listFormatVersions,
  listTournamentCoverage,
  matchDeckCards,
  setRatingWindow,
  setTournamentFormats,
  setTournamentInclusion,
} from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { RatingWindowState } from "@/components/processing/rating-window-form";
import { requireRole } from "@/lib/auth/guard";
import { cardIndex } from "@/lib/cards/card-index";
import { findCardMatches } from "@/lib/decks/match-deck-cards.server";
import { placeEventDecks } from "@/lib/decks/place-event-decks.server";
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

/**
 * Put an event in these format versions, first one first (E20.66), and each
 * deck it made in the first of them the deck is legal in.
 */
export async function setEventFormats(id: string, formatVersionIds: readonly string[]) {
  await requireRole("admin");
  const service = createServiceRoleClient();
  const known = new Set((await listFormatVersions(service)).map((version) => version.id));
  const chosen = [...new Set(formatVersionIds)].filter((formatId) => known.has(formatId));
  if (chosen.length === 0) return;

  const formats = chosen as FormatVersionId[];
  await setTournamentFormats(service, id as TournamentId, formats);
  await placeEventDecks(service, id as TournamentId, formats);
  revalidatePath("/", "layout");
}

/** Match the decklist lines that name a card the card data has gained since (E20.56). */
export async function matchCards(): Promise<never> {
  await requireRole("admin");
  const service = createServiceRoleClient();
  const matched = await matchDeckCards(service, (await findCardMatches(service)).matches);

  revalidatePath("/", "layout");
  redirect(`/admin/processing?done=matched&lines=${matched}`);
}

/**
 * Match the lines naming a card the card data can't read to the card an admin
 * chose (E20.57) — a misspelling in the source list. The name stays as written.
 */
export async function confirmCardMatch(form: FormData): Promise<never> {
  await requireRole("admin");
  const name = form.get("name")?.toString() ?? "";
  const oracleId = (form.get("oracle_id")?.toString() ?? "") as OracleId;
  let matched = 0;
  if (name !== "" && cardIndex().byOracleId.has(oracleId)) {
    matched = await matchDeckCards(createServiceRoleClient(), [{ name, oracleId }]);
    revalidatePath("/", "layout");
  }
  redirect(`/admin/processing?done=matched&lines=${matched}`);
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
