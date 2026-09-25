"use server";

import { cardIndex } from "@/lib/cards/card-index";
import type { FormatVersionId } from "@ps/contracts";
import { checkFormatDraft, type FormatDraftProblem } from "@ps/core";
import { deleteFormatVersion, saveFormatVersion } from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/guard";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Create, edit and delete format versions (E20.33). Written with the admin's own
 * client, so `format_*_admin_write` checks the role again underneath.
 */
export interface FormatSaveState {
  readonly problems: readonly FormatDraftProblem[];
}

export async function saveFormat(
  _previous: FormatSaveState,
  form: FormData,
): Promise<FormatSaveState> {
  await requireRole("admin");
  const text = (name: string) => form.get(name)?.toString() ?? "";
  const all = (name: string) => form.getAll(name).map((value) => value.toString());
  const id = text("id") === "" ? null : (text("id") as FormatVersionId);

  const reasons = all("rule_reason");
  const froms = all("rule_from");
  const rulings = all("rule_ruling");
  const check = checkFormatDraft(
    {
      name: text("name"),
      effectiveFrom: text("effective_from"),
      effectiveTo: text("effective_to"),
      notes: text("notes"),
      isCurrent: form.get("is_current") === "on",
      legalSets: [...all("set"), ...text("other_sets").split(/[\s,]+/)],
      minMaindeck: text("min_maindeck"),
      maxMaindeck: text("max_maindeck"),
      maxSideboard: text("max_sideboard"),
      maxCopies: text("max_copies"),
      singleton: form.get("singleton") === "on",
      cardRules: all("rule_card").map((cardName, i) => ({
        cardName,
        ruling: rulings[i] ?? "",
        reason: reasons[i] ?? "",
        effectiveFrom: froms[i] ?? "",
      })),
    },
    cardIndex(),
  );
  if (!check.ok) return { problems: check.problems };

  const saved = await saveFormatVersion(await createSessionClient(), id, check.value);
  revalidatePath("/admin/formats");
  revalidatePath("/rules");
  redirect(`/admin/formats?done=${id === null ? "created" : "saved"}&id=${saved}`);
}

export async function deleteFormat(form: FormData): Promise<void> {
  await requireRole("admin");
  const id = (form.get("id")?.toString() ?? "") as FormatVersionId;

  const result = await deleteFormatVersion(await createSessionClient(), id);
  if (!result.ok) redirect(`/admin/formats/${id}?error=${result.reason}`);

  revalidatePath("/admin/formats");
  redirect("/admin/formats?done=deleted");
}
