import { listFormatVersions } from "@ps/db";
import type { Metadata } from "next";

import { RunForm } from "@/components/play/run-form";
import { PlayNotice } from "@/components/play/notice";
import { messageFor, RUN_ERRORS } from "@/components/play/run-messages";
import { requireRole } from "@/lib/auth/guard";
import { createSessionClient } from "@/lib/supabase/session";

import { createRunAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New event" };

/** An organizer sets up a run (E26.16). It starts as a draft only they and admins can see. */
export default async function NewRunPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("organizer");
  const error = messageFor(RUN_ERRORS, (await searchParams)["error"]);
  const versions = await listFormatVersions(await createSessionClient());

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">New event</h1>
      <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
        A draft until you open registration: only you and admins can see it.
      </p>
      {error !== null && (
        <div className="mt-4">
          <PlayNotice tone="warn">{error}</PlayNotice>
        </div>
      )}
      <div className="mt-6">
        <RunForm
          run={null}
          versions={versions}
          structureLocked={false}
          action={createRunAction}
          submitLabel="Create draft"
        />
      </div>
    </div>
  );
}
