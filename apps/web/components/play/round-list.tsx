import type { PostedRunPairing, RunEntrant, RunRound } from "@ps/contracts";
import type { ReactNode } from "react";

/** `2–1` or `1–1–1`: wins first from player 1's side, draws only when there were some. */
export function gamesText(pairing: PostedRunPairing): string {
  const games = pairing.games;
  if (games === null) return "";
  const score = `${games.p1Wins}–${games.p2Wins}`;
  return games.draws > 0 ? `${score}–${games.draws}` : score;
}

const STATUS: Readonly<Record<PostedRunPairing["status"], string>> = {
  pending: "playing",
  reported: "waiting to be confirmed",
  confirmed: "",
};

/**
 * A run's rounds, latest first (E26.19). `controls` lets the result stories add their
 * buttons to a pairing without this list knowing who may press them.
 */
export function RoundList({
  rounds,
  pairings,
  entrants,
  controls,
}: {
  rounds: readonly RunRound[];
  pairings: readonly PostedRunPairing[];
  entrants: readonly RunEntrant[];
  controls?: (pairing: PostedRunPairing) => ReactNode;
}) {
  if (rounds.length === 0) return null;
  const name = new Map(entrants.map((e) => [e.id, e.displayName]));

  return (
    <section className="space-y-5">
      {[...rounds].reverse().map((round) => (
        <div key={round.id}>
          <h2 className="font-display text-xl">
            {round.kind === "elimination" ? "Top cut, round" : "Round"} {round.number}
          </h2>
          <ul className="mt-2 divide-y divide-ink-200 text-sm dark:divide-ink-800">
            {pairings
              .filter((p) => p.roundId === round.id)
              .map((pairing) => (
                <li key={pairing.id} className="py-2.5">
                  <div className="flex items-baseline gap-3">
                    <span className="w-6 shrink-0 text-xs text-ink-500 tabular-nums">
                      {pairing.table}
                    </span>
                    <span className="min-w-0 flex-1">
                      {name.get(pairing.p1EntrantId) ?? "?"}
                      {pairing.p2EntrantId === null ? (
                        <span className="text-ink-500"> has a bye</span>
                      ) : (
                        <>
                          <span className="text-ink-500"> vs </span>
                          {name.get(pairing.p2EntrantId) ?? "?"}
                        </>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums">
                      {gamesText(pairing)}
                    </span>
                    {STATUS[pairing.status] !== "" && pairing.p2EntrantId !== null && (
                      <span className="shrink-0 text-xs text-ink-500">
                        {STATUS[pairing.status]}
                      </span>
                    )}
                  </div>
                  {controls?.(pairing)}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
