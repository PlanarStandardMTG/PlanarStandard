import { listFormatVersions, listMemberDecks, listRunEntrantDecks } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PRIMARY, QUIET, SECONDARY } from "@/components/play/button";
import { EntrantList } from "@/components/play/entrant-list";
import { PlayNotice } from "@/components/play/notice";
import { RegistrationPanel } from "@/components/play/registration-panel";
import { RoundList } from "@/components/play/round-list";
import { messageFor, RUN_DONE, RUN_ERRORS, STATE_LABEL } from "@/components/play/run-messages";
import { LocalTime } from "@/components/ui/local-time";
import { currentViewer } from "@/lib/auth/viewer";
import { loadRun } from "@/lib/runs/load-run";
import { createSessionClient } from "@/lib/supabase/session";

import { deleteDraftRunAction, moveRunAction, pairRoundAction, startRunAction } from "../actions";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const view = await loadRun(await createSessionClient(), (await params).id);
  return { title: view?.run.name ?? "Run" };
}

function structureOf(swissRounds: number, topCut: number): string {
  const swiss =
    swissRounds === 0 ? "" : `${swissRounds} Swiss round${swissRounds === 1 ? "" : "s"}`;
  const cut = topCut >= 2 ? `top ${topCut}` : "";
  if (swiss === "") return `Single elimination, ${cut}`;
  return cut === "" ? swiss : `${swiss}, then a ${cut}`;
}

/** One run, for everyone who may see it, with its organizer's controls (E26.16). */
export default async function RunPage({
  params,
  searchParams,
}: Params & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const client = await createSessionClient();
  const [view, viewer, versions] = await Promise.all([
    loadRun(client, id),
    currentViewer(),
    listFormatVersions(client),
  ]);
  if (view === null) notFound();
  const { run, entrants, rounds, pairings, position } = view;

  const query = await searchParams;
  const error = messageFor(RUN_ERRORS, query["error"]);
  const done = messageFor(RUN_DONE, query["done"]);
  const manages =
    viewer !== null &&
    (viewer.profile.role === "admin" ||
      (viewer.profile.role === "organizer" && run.organizerId === viewer.profile.id));
  const versionName = new Map(versions.map((v) => [v.id, v.name]));
  const mine =
    viewer === null ? null : (entrants.find((e) => e.profileId === viewer.profile.id) ?? null);
  const [decks, memberDecks] = await Promise.all([
    viewer === null ? Promise.resolve([]) : listRunEntrantDecks(client, run.id),
    viewer === null ? Promise.resolve([]) : listMemberDecks(client, viewer.profile.id),
  ]);
  const deckOf = new Map(decks.map((d) => [d.entrantId, d]));
  const latest = rounds.at(-1);
  // A round nobody has reported in yet can still be re-paired whole.
  const unplayed =
    latest?.kind === "swiss" &&
    pairings.every(
      (p) => p.roundId !== latest.id || p.p2EntrantId === null || p.status === "pending",
    );

  return (
    <div className="space-y-6">
      {error !== null && <PlayNotice tone="warn">{error}</PlayNotice>}
      {done !== null && <PlayNotice tone="good">{done}</PlayNotice>}

      <header>
        <p className="text-xs font-medium tracking-wide text-gold-700 uppercase dark:text-gold-400">
          {STATE_LABEL[run.state] ?? run.state}
        </p>
        <h1 className="font-display text-3xl tracking-tight">{run.name}</h1>
        <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
          {run.startsAt !== null && (
            <>
              <LocalTime iso={run.startsAt} />
              {" · "}
            </>
          )}
          {structureOf(run.swissRounds, run.topCut)}
        </p>
        {run.formatVersionIds.length > 0 && (
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
            {run.formatVersionIds.map((v) => versionName.get(v) ?? "Unknown version").join(" · ")}
          </p>
        )}
        {run.description !== null && (
          <p className="mt-3 text-sm whitespace-pre-line">{run.description}</p>
        )}
      </header>

      {manages && (
        <section
          aria-label="Organizer"
          className="rounded-xl border border-ink-200 p-4 dark:border-ink-800"
        >
          <h2 className="text-sm font-semibold">Organizer</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {run.state === "draft" && (
              <form action={moveRunAction}>
                <input type="hidden" name="runId" value={run.id} />
                <button name="to" value="registration" className={PRIMARY}>
                  Open registration
                </button>
              </form>
            )}
            {run.state === "registration" && (
              <form action={startRunAction}>
                <input type="hidden" name="runId" value={run.id} />
                <button className={PRIMARY}>Start ({position.checkedInEntrants} checked in)</button>
              </form>
            )}
            {run.state === "running" &&
              position.swissRoundsPaired < run.swissRounds &&
              position.unconfirmedPairings === 0 && (
                <form action={pairRoundAction}>
                  <input type="hidden" name="runId" value={run.id} />
                  <button className={PRIMARY}>Pair round {position.nextRound}</button>
                </form>
              )}
            {run.state === "running" && unplayed && (
              <form action={pairRoundAction}>
                <input type="hidden" name="runId" value={run.id} />
                <input type="hidden" name="repair" value="1" />
                <button className={SECONDARY}>Re-pair round {latest?.number}</button>
              </form>
            )}
            {!["finished", "cancelled"].includes(run.state) && (
              <Link href={`/play/runs/${run.id}/edit`} className={SECONDARY}>
                Edit
              </Link>
            )}
            {run.state === "draft" ? (
              <form action={deleteDraftRunAction}>
                <input type="hidden" name="runId" value={run.id} />
                <button className={QUIET}>Delete draft</button>
              </form>
            ) : (
              !["finished", "cancelled"].includes(run.state) && (
                <form action={moveRunAction}>
                  <input type="hidden" name="runId" value={run.id} />
                  <button name="to" value="cancelled" className={QUIET}>
                    Cancel run
                  </button>
                </form>
              )
            )}
          </div>
        </section>
      )}

      <RegistrationPanel
        run={run}
        viewer={viewer}
        entrant={mine}
        deck={mine === null ? null : (deckOf.get(mine.id) ?? null)}
        decks={memberDecks}
      />

      <RoundList rounds={rounds} pairings={pairings} entrants={entrants} />

      <EntrantList run={run} entrants={entrants} decks={deckOf} manages={manages} />
    </div>
  );
}
