import type { PostedRunPairing, RunEntrant, RunStanding } from "@ps/contracts";
import type { ReactNode } from "react";

import { CopyButton } from "./copy-button";

/**
 * The viewer's own part of a run (E26.25): this round's opponent and table, the
 * opponent's Arena username to send a Direct Challenge, their record so far, and
 * whatever `controls` the page gives them for reporting.
 */
export function MyMatch({
  me,
  pairing,
  roundNumber,
  opponent,
  opponentArena,
  standing,
  controls,
  notifications,
}: {
  me: RunEntrant;
  pairing: PostedRunPairing | null;
  roundNumber: number | null;
  opponent: RunEntrant | null;
  opponentArena: string | null;
  standing: RunStanding | null;
  controls: ReactNode;
  /** The "Allow notifications" button, when the site can send them. */
  notifications: ReactNode;
}) {
  const record =
    standing === null
      ? null
      : `${standing.wins}–${standing.losses}${standing.draws > 0 ? `–${standing.draws}` : ""}`;

  return (
    <section aria-label="Your match" className="rounded-xl border-2 border-gold-500/50 p-4">
      <p className="text-xs font-medium tracking-wide text-gold-700 uppercase dark:text-gold-400">
        {roundNumber === null ? "Your match" : `Round ${roundNumber}`}
        {record !== null && <span className="ml-2 text-ink-500 normal-case">{record}</span>}
      </p>

      {me.droppedAfterRound !== null ? (
        <p className="mt-2 text-sm">Dropped.</p>
      ) : pairing === null ? (
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">Waiting for pairings.</p>
      ) : pairing.p2EntrantId === null ? (
        <p className="mt-2 text-lg font-semibold">Bye</p>
      ) : (
        <>
          <p className="mt-2 text-lg">
            Table {pairing.table} against <strong>{opponent?.displayName ?? "?"}</strong>
          </p>
          {opponentArena !== null ? (
            <div className="mt-2 flex items-center gap-3">
              <code className="rounded bg-ink-100 px-2 py-1 font-mono text-sm dark:bg-ink-900">
                {opponentArena}
              </code>
              <CopyButton text={opponentArena} label={`Copy ${opponentArena}`} />
            </div>
          ) : (
            <p className="mt-1 text-sm text-ink-500">No Arena username.</p>
          )}
          {controls}
        </>
      )}
      {notifications !== null && <div className="mt-3">{notifications}</div>}
    </section>
  );
}
