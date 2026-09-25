import type { FormatVersionId } from "@ps/contracts";
import { DEFAULT_CONSTRAINTS } from "@ps/core";
import { getFormatDetail } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Notice } from "@/components/auth/form-parts";
import { DeleteFormatButton } from "@/components/format/delete-format-button";
import { FormatVersionForm } from "@/components/format/format-version-form";
import { requireRole } from "@/lib/auth/guard";
import { cardIndex, cardSetCodes } from "@/lib/cards/card-index";
import { createSessionClient } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit format version",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ERRORS: Readonly<Record<string, string>> = {
  current:
    "The version in force can’t be deleted. Mark another version as in force first, then delete this one.",
  "in-use":
    "A season, tournament or deck was checked against this version, so it can’t be deleted. Give it an end date instead.",
};

/** View and edit one version, card rules shown by name (E20.33). */
export default async function EditFormatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const { error } = await searchParams;
  if (!UUID.test(id)) notFound();

  const detail = await getFormatDetail(await createSessionClient(), id as FormatVersionId);
  if (detail === null) notFound();

  const { version, legalSets, cardRules } = detail;
  const constraints = detail.constraints ?? DEFAULT_CONSTRAINTS;
  const index = cardIndex();

  return (
    <>
      <Link
        href="/admin/formats"
        className="text-sm text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
      >
        <span aria-hidden="true">←</span> Formats
      </Link>
      <header className="mt-2 mb-8 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{version.name}</h1>
        <DeleteFormatButton id={version.id} name={version.name} />
      </header>

      {typeof error === "string" && ERRORS[error] !== undefined && (
        <div className="mb-6">
          <Notice tone="warn">{ERRORS[error]}</Notice>
        </div>
      )}

      <FormatVersionForm
        id={version.id}
        knownSets={cardSetCodes()}
        initial={{
          name: version.name,
          effectiveFrom: version.effectiveFrom,
          effectiveTo: version.effectiveTo ?? "",
          notes: version.notesMarkdown ?? "",
          isCurrent: version.isCurrent,
          legalSets,
          minMaindeck: String(constraints.minMaindeck),
          maxMaindeck: constraints.maxMaindeck === null ? "" : String(constraints.maxMaindeck),
          maxSideboard: String(constraints.maxSideboard),
          maxCopies: String(constraints.maxCopies),
          singleton: constraints.singleton,
          cardRules: cardRules.map((rule) => ({
            cardName: index.byOracleId.get(rule.oracleId)?.card.name ?? rule.oracleId,
            ruling: rule.ruling,
            reason: rule.reason ?? "",
            effectiveFrom: rule.effectiveFrom ?? "",
          })),
        }}
      />
    </>
  );
}
