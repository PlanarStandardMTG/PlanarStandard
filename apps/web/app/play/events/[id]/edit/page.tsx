import { listFormatVersions } from "@ps/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RunForm } from "@/components/play/run-form";
import { PlayNotice } from "@/components/play/notice";
import { messageFor, RUN_ERRORS } from "@/components/play/run-messages";
import { requireRole } from "@/lib/auth/guard";
import { loadRun } from "@/lib/runs/load-run";
import { createSessionClient } from "@/lib/supabase/session";

import { updateRunAction } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit event" };

export default async function EditRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireRole("organizer");
  const { id } = await params;
  const client = await createSessionClient();
  const view = await loadRun(client, id);
  if (view === null) notFound();
  const manages = viewer.profile.role === "admin" || view.run.organizerId === viewer.profile.id;
  if (!manages) notFound();

  const error = messageFor(RUN_ERRORS, (await searchParams)["error"]);
  const versions = await listFormatVersions(client);

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">Edit {view.run.name}</h1>
      {error !== null && (
        <div className="mt-4">
          <PlayNotice tone="warn">{error}</PlayNotice>
        </div>
      )}
      <div className="mt-6">
        <RunForm
          run={view.run}
          versions={versions}
          structureLocked={!["draft", "registration"].includes(view.run.state)}
          action={updateRunAction}
          submitLabel="Save"
        />
      </div>
    </div>
  );
}
