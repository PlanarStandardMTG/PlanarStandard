import { canMoveRun } from "@ps/core";
import type { PostedRunPairing } from "@ps/contracts";
import {
  getEntrantArenaUsername,
  listFormatVersions,
  listMemberDecks,
  listRunEntrantDecks,
  listTournamentsByIds,
} from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PRIMARY, QUIET, SECONDARY } from "@/components/play/button";
import { EntrantList } from "@/components/play/entrant-list";
import { LiveRefresh } from "@/components/play/live-refresh";
import { MyMatch } from "@/components/play/my-match";
import { NotificationsButton } from "@/components/play/notifications-button";
import { PlayNotice } from "@/components/play/notice";
import { RegistrationPanel } from "@/components/play/registration-panel";
import { ResultControls } from "@/components/play/result-controls";
import { RoundList } from "@/components/play/round-list";
import { StandingsTable } from "@/components/play/standings-table";
import { messageFor, RUN_DONE, RUN_ERRORS, STATE_LABEL } from "@/components/play/run-messages";
import { LocalTime } from "@/components/ui/local-time";
import { currentViewer } from "@/lib/auth/viewer";
import { loadRun } from "@/lib/runs/load-run";
import { createSessionClient } from "@/lib/supabase/session";

import {
  deleteDraftRunAction,
  finishRunAction,
  moveRunAction,
  pairCutRoundAction,
  pairRoundAction,
  startRunAction,
} from "../actions";

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
  const [tournament] =
    run.tournamentId === null ? [] : await listTournamentsByIds(client, [run.tournamentId]);
  const cutCanStart = run.state === "running" && canMoveRun(run, "top_cut", position).ok;
  const cutCanPair =
    run.state === "top_cut" && position.unconfirmedPairings === 0 && !position.cutFinished;
  const canFinish =
    run.state === "finished"
      ? position.unconfirmedPairings === 0
      : canMoveRun(run, "finished", position).ok;
  const latest = rounds.at(-1);
  const controlsFor = (pairing: PostedRunPairing) => (
    <ResultControls
      runId={run.id}
      pairing={pairing}
      side={
        mine === null
          ? null
          : mine.id === pairing.p1EntrantId
            ? "p1"
            : mine.id === pairing.p2EntrantId
              ? "p2"
              : null
      }
      viewerProfileId={viewer?.profile.id ?? null}
      manages={manages}
      elimination={rounds.find((r) => r.id === pairing.roundId)?.kind === "elimination"}
      playing={run.state === "running" || run.state === "top_cut"}
      correcting={run.state === "finished"}
      p1Name={entrants.find((e) => e.id === pairing.p1EntrantId)?.displayName ?? "Player 1"}
    />
  );
  const playing = run.state === "running" || run.state === "top_cut";
  const vapidKey = process.env["NEXT_PUBLIC_VAPID_PUBLIC_KEY"] || undefined;
  const myPairing =
    mine === null || latest === undefined
      ? null
      : (pairings.find(
          (p) =>
            p.roundId === latest.id && (p.p1EntrantId === mine.id || p.p2EntrantId === mine.id),
        ) ?? null);
  const opponentId =
    myPairing === null || mine === null
      ? null
      : myPairing.p1EntrantId === mine.id
        ? myPairing.p2EntrantId
        : myPairing.p1EntrantId;
  const opponent = entrants.find((e) => e.id === opponentId) ?? null;
  // Readable only while the two are paired (0049, 0050); null otherwise.
  const opponentArena =
    playing && opponent !== null ? await getEntrantArenaUsername(client, opponent) : null;
  // A round nobody has reported in yet can still be re-paired whole.
  const unplayed =
    latest?.kind === "swiss" &&
    pairings.every(
      (p) => p.roundId !== latest.id || p.p2EntrantId === null || p.status === "pending",
    );

  return (
    <div className="space-y-6">
      {run.state !== "draft" && run.state !== "cancelled" && <LiveRefresh runId={run.id} />}
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
        {tournament !== undefined && (
          <p className="mt-2 text-sm">
            <Link
              href={`/tournaments/${tournament.slug}`}
              className="font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
            >
              Results on the site
            </Link>
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
            {(cutCanStart || cutCanPair) && (
              <form action={pairCutRoundAction}>
                <input type="hidden" name="runId" value={run.id} />
                <button className={PRIMARY}>
                  {cutCanStart
                    ? `Start the top ${run.topCut}`
                    : `Pair top cut round ${position.nextRound}`}
                </button>
              </form>
            )}
            {canFinish && (
              <form action={finishRunAction}>
                <input type="hidden" name="runId" value={run.id} />
                <button className={run.state === "finished" ? SECONDARY : PRIMARY}>
                  {run.state === "finished" ? "Import again" : "Finish and import"}
                </button>
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

      {mine !== null && playing && (
        <MyMatch
          me={mine}
          pairing={myPairing}
          roundNumber={latest?.number ?? null}
          opponent={opponent}
          opponentArena={opponentArena}
          standing={view.standings.find((s) => s.entrantId === mine.id) ?? null}
          controls={myPairing === null ? null : controlsFor(myPairing)}
          notifications={
            vapidKey === undefined ? null : <NotificationsButton publicKey={vapidKey} />
          }
        />
      )}

      <RegistrationPanel
        run={run}
        viewer={viewer}
        entrant={mine}
        deck={mine === null ? null : (deckOf.get(mine.id) ?? null)}
        decks={memberDecks}
      />

      <RoundList
        rounds={rounds}
        pairings={pairings}
        entrants={entrants}
        controls={(pairing) =>
          // A player's own match is reported from the card above.
          pairing.id === myPairing?.id && !manages ? null : controlsFor(pairing)
        }
      />

      <StandingsTable standings={view.standings} entrants={entrants} />

      <EntrantList run={run} entrants={entrants} decks={deckOf} manages={manages} />
    </div>
  );
}
