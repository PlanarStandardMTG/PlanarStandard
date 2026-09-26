import type { Metadata } from "next";
import Link from "next/link";

import { FormatVersionForm } from "@/components/format/format-version-form";
import { requireRole } from "@/lib/auth/guard";
import { cardSetCodes } from "@/lib/cards/card-index";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New format version",
  robots: { index: false, follow: false },
};

/** A new version of the rules, starting from constructed Magic's usual limits (E20.33). */
export default async function NewFormatPage() {
  await requireRole("admin");
  const knownSets = cardSetCodes();

  return (
    <>
      <Link
        href="/admin/formats"
        className="text-sm text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
      >
        <span aria-hidden="true">←</span> Formats
      </Link>
      <h1 className="mt-2 mb-8 font-serif text-4xl tracking-tight sm:text-5xl">
        New format version
      </h1>
      <FormatVersionForm
        id={null}
        knownSets={knownSets}
        initial={{
          name: "",
          effectiveFrom: "",
          effectiveTo: "",
          notes: "",
          isCurrent: false,
          legalSets: knownSets,
          minMaindeck: "60",
          maxMaindeck: "",
          maxSideboard: "15",
          maxCopies: "4",
          singleton: false,
          cardRules: [],
        }}
      />
    </>
  );
}
