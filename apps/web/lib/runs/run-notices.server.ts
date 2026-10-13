import type { PostedRunPairing, ProfileId, RunEntrant, RunId, RunPairingId } from "@ps/contracts";
import { getEntrantArenaUsername } from "@ps/db";

import { sendPush, type PushMessage } from "@/lib/push/send-push.server";
import { createServiceRoleClient } from "@/lib/supabase/service-role.server";

import { loadRun, type RunView } from "./load-run";

/**
 * The three things the play app tells a member when it is closed (§28, E26.28): their
 * new pairing, a result their opponent reported for them to confirm, and the organizer
 * chasing a result still missing. Read as service-role, since a pairing's push carries
 * the opponent's Arena name — which the member could read on the page anyway.
 *
 * A notification never fails the action that sent it: errors are logged, not thrown.
 */

async function serviceView(runId: RunId): Promise<RunView | null> {
  return loadRun(createServiceRoleClient(), runId);
}

function opponentOf(pairing: PostedRunPairing, entrant: RunEntrant): string | null {
  return pairing.p1EntrantId === entrant.id ? pairing.p2EntrantId : pairing.p1EntrantId;
}

async function quietly(work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch (error) {
    console.error("run notification failed:", error);
  }
}

/** Each member in the round just paired: their table, opponent and opponent's Arena name. */
export async function notifyRoundPaired(runId: RunId, roundNumber: number): Promise<void> {
  await quietly(async () => {
    const view = await serviceView(runId);
    if (view === null) return;
    const service = createServiceRoleClient();
    const byId = new Map(view.entrants.map((e) => [e.id, e]));
    const round = view.rounds.find((r) => r.number === roundNumber);
    const label =
      round?.kind === "elimination" ? `Top cut, round ${roundNumber}` : `Round ${roundNumber}`;
    const url = `/play/events/${runId}`;

    await Promise.all(
      view.pairings
        .filter((p) => p.round === roundNumber)
        .flatMap((pairing) =>
          [pairing.p1EntrantId, pairing.p2EntrantId].map(async (id) => {
            const entrant = id === null ? undefined : byId.get(id);
            if (entrant?.profileId == null) return;
            const opponent = byId.get(opponentOf(pairing, entrant) ?? "");
            const arena =
              opponent === undefined ? null : await getEntrantArenaUsername(service, opponent);
            const message: PushMessage = {
              title: `${view.run.name}: ${label}`,
              body:
                opponent === undefined
                  ? "You have a bye this round."
                  : `Table ${pairing.table} against ${opponent.displayName}${arena === null ? "" : ` (${arena})`}.`,
              url,
              tag: `run-${runId}-round`,
            };
            await sendPush([entrant.profileId], message);
          }),
        ),
    );
  });
}

/** The other player, when one reports: it counts once they confirm. */
export async function notifyResultReported(
  runId: RunId,
  pairingId: RunPairingId,
  reporter: ProfileId,
): Promise<void> {
  await quietly(async () => {
    const view = await serviceView(runId);
    const pairing = view?.pairings.find((p) => p.id === pairingId);
    if (view === null || pairing === undefined || pairing.status !== "reported") return;
    const players = view.entrants.filter(
      (e) => e.id === pairing.p1EntrantId || e.id === pairing.p2EntrantId,
    );
    const reporterEntrant = players.find((e) => e.profileId === reporter);
    const others = players.filter((e) => e.profileId !== null && e.profileId !== reporter);
    await sendPush(
      others.map((e) => e.profileId as ProfileId),
      {
        title: `${view.run.name}: confirm your result`,
        body: `${reporterEntrant?.displayName ?? "Your opponent"} reported your match. Check it and confirm.`,
        url: `/play/events/${runId}`,
        tag: `run-${runId}-result`,
      },
    );
  });
}

/** Both players of a pairing still missing its result, when the organizer chases it (E26.27). */
export async function notifyResultChased(runId: RunId, pairingId: RunPairingId): Promise<number> {
  let sent = 0;
  await quietly(async () => {
    const view = await serviceView(runId);
    const pairing = view?.pairings.find((p) => p.id === pairingId);
    if (view === null || pairing === undefined) return;
    const profiles = view.entrants
      .filter(
        (e) =>
          (e.id === pairing.p1EntrantId || e.id === pairing.p2EntrantId) && e.profileId !== null,
      )
      .map((e) => e.profileId as ProfileId);
    sent = await sendPush(profiles, {
      title: `${view.run.name}: your result is needed`,
      body:
        pairing.status === "reported"
          ? `Table ${pairing.table}: a result is waiting to be confirmed.`
          : `Table ${pairing.table}: the organizer is waiting for your result.`,
      url: `/play/events/${runId}`,
      tag: `run-${runId}-chase`,
    });
  });
  return sent;
}
