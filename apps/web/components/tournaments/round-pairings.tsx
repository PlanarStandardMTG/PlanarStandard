import type { EventRound } from "@ps/core";

import { cn } from "@/lib/cn";
import type { Pairing, PairingSide } from "@/lib/tournaments/tournament-view";

import { EntryDeckLink } from "./entry-deck";

/** One round's matches: who played whom, who won, and the games when the source gave them. */
export function RoundPairings({ round }: { round: EventRound<Pairing> }) {
  return (
    <ul className="grid gap-2 lg:grid-cols-2">
      {round.matches.map((match) => (
        <li
          key={match.id}
          className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border border-ink-200 px-4 py-2.5 dark:border-ink-800"
        >
          <Side side={match.p1} won={match.result === "p1_win" || match.result === "bye"} />
          <Score match={match} />
          {match.p2 === null ? (
            <span className="text-right text-sm text-ink-500 dark:text-ink-400">Bye</span>
          ) : (
            <Side side={match.p2} won={match.result === "p2_win"} align="right" />
          )}
        </li>
      ))}
    </ul>
  );
}

function Side({
  side,
  won,
  align = "left",
}: {
  side: PairingSide;
  won: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className={cn("min-w-0", align === "right" && "text-right")}>
      <span
        className={cn("block truncate", won ? "font-semibold" : "text-ink-600 dark:text-ink-400")}
      >
        {side.name}
      </span>
      {side.deck !== null && (
        <span className="block text-xs">
          <EntryDeckLink deck={side.deck} />
        </span>
      )}
    </div>
  );
}

function Score({ match }: { match: Pairing }) {
  const played = match.p1Games + match.p2Games + match.gameDraws > 0;
  const text =
    match.result === "bye"
      ? "—"
      : match.result === "double_loss"
        ? "Double loss"
        : played
          ? `${match.p1Games}–${match.p2Games}${match.gameDraws > 0 ? `–${match.gameDraws}` : ""}`
          : match.result === "draw"
            ? "Draw"
            : "—";
  return (
    <span className="shrink-0 text-center font-mono text-sm tabular-nums text-ink-700 dark:text-ink-300">
      {text}
    </span>
  );
}
