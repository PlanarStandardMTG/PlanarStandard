"use server";

import { cardIndex } from "@/lib/cards/card-index";
import type { FormatVersionId } from "@ps/contracts";
import { checkFormatDraft, rulesChange } from "@ps/core";
import { deleteFormatVersion, getFormatDetail, saveFormatVersion, setLegalityStale } from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormatSaveState } from "@/components/format/format-version-form";
import { requireRole } from "@/lib/auth/guard";
import { recheckVersion } from "@/lib/decks/deck-traits.server";
import { formatRules } from "@/lib/decks/deck-view";
import { createServiceRoleClient } from "@/lib/supabase/service-role.server";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Create, edit and delete format versions (E20.33). Written with the admin's own
 * client, so `format_*_admin_write` checks the role again underneath.
 */

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
      notes: text("notes"),
      isCurrent: form.get("is_current") === "on",
      legalSets: [...all("set"), ...text("other_sets").split(/[\s,]+/)],
      coreSets: all("core_set"),
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

  const session = await createSessionClient();
  const before = id === null ? null : formatRules(await getFormatDetail(session, id));
  const saved = await saveFormatVersion(session, id, check.value);
  const after = formatRules(await getFormatDetail(session, saved));

  // Stored deck legality (E20.72). A narrowing edit waits for an admin to
  // recheck every deck, so several edits cost one; a new or widened version is
  // rechecked now, or decks it newly allows would stay hidden from `/decks`.
  const change = before === null || after === null ? null : rulesChange(before, after);
  const service = createServiceRoleClient();
  if (change?.narrowed === true) await setLegalityStale(service, [saved], true);
  else if (change === null || change.widened) await recheckVersion(service, saved);

  revalidatePath("/admin/formats");
  revalidatePath("/decks");
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
