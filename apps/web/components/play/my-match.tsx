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
}: {
  me: RunEntrant;
  pairing: PostedRunPairing | null;
  roundNumber: number | null;
  opponent: RunEntrant | null;
  opponentArena: string | null;
  standing: RunStanding | null;
  controls: ReactNode;
}) {
  const record =
    standing === null
      ? null
      : `${standing.wins}–${standing.losses}${standing.draws > 0 ? `–${standing.draws}` : ""}`;

  return (
    <section aria-label="Your match" className="rounded-xl border-2 border-gold-500/50 p-4">
      <p className="text-xs font-medium tracking-wide text-gold-700 uppercase dark:text-gold-400">
        {roundNumber === null ? "You are in" : `Round ${roundNumber}`}
        {record !== null && <span className="ml-2 text-ink-500 normal-case">you are {record}</span>}
      </p>

      {me.droppedAfterRound !== null ? (
        <p className="mt-2 text-sm">You have dropped. Thanks for playing.</p>
      ) : pairing === null ? (
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">
          No pairing yet. It appears here as soon as the organizer pairs the round.
        </p>
      ) : pairing.p2EntrantId === null ? (
        <p className="mt-2 text-lg font-semibold">You have a bye this round.</p>
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
            <p className="mt-1 text-sm text-ink-500">
              They have not shared an Arena username. Ask the organizer.
            </p>
          )}
          {controls}
        </>
      )}
    </section>
  );
}
