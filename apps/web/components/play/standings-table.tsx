import type { RunEntrant, RunStanding } from "@ps/contracts";

/** A tiebreaker as the MTR prints it: a fraction to two decimals (§28). */
const two = (value: number) => value.toFixed(2);

/**
 * The Swiss standings (E26.26): points, record and the three tiebreakers. They are
 * compared at full precision; only the display rounds, which is why two lines can
 * show the same figures in a set order.
 */
export function StandingsTable({
  title,
  standings,
  entrants,
}: {
  title: string;
  standings: readonly RunStanding[];
  entrants: readonly RunEntrant[];
}) {
  if (standings.length === 0 || standings.every((s) => s.roundsPlayed === 0)) return null;
  const name = new Map(entrants.map((e) => [e.id, e.displayName]));

  return (
    <section>
      <h2 className="font-display text-xl">{title}</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <thead className="text-xs text-ink-500 dark:text-ink-400">
            <tr>
              <th className="py-1.5 pr-2 font-medium">#</th>
              <th className="py-1.5 pr-2 font-medium">Player</th>
              <th className="py-1.5 pr-2 text-right font-medium">Pts</th>
              <th className="py-1.5 pr-2 text-right font-medium">W–L–D</th>
              <th className="py-1.5 pr-2 text-right font-medium" title="Opponents' match-win">
                OMW
              </th>
              <th className="py-1.5 pr-2 text-right font-medium" title="Game-win">
                GW
              </th>
              <th className="py-1.5 text-right font-medium" title="Opponents' game-win">
                OGW
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
            {standings.map((line) => (
              <tr key={line.entrantId} className={line.dropped ? "text-ink-500" : ""}>
                <td className="py-1.5 pr-2">{line.rank}</td>
                <td className="py-1.5 pr-2">
                  {name.get(line.entrantId) ?? "?"}
                  {line.dropped && <span className="ml-1.5 text-xs">dropped</span>}
                </td>
                <td className="py-1.5 pr-2 text-right font-semibold">{line.matchPoints}</td>
                <td className="py-1.5 pr-2 text-right">
                  {line.wins}–{line.losses}–{line.draws}
                </td>
                <td className="py-1.5 pr-2 text-right">{two(line.opponentMatchWinPct)}</td>
                <td className="py-1.5 pr-2 text-right">{two(line.gameWinPct)}</td>
                <td className="py-1.5 text-right">{two(line.opponentGameWinPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
