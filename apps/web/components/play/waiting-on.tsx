import type { PostedRunPairing, RunEntrant } from "@ps/contracts";

import { chaseResultAction } from "@/app/play/events/actions";

import { QUIET } from "./button";

/**
 * The organizer's view of the round in play (E26.27): how many results are in, and
 * which tables are still out, each with a nudge to its players. Rounds have no timer;
 * the next one is paired when this list is empty (§28).
 */
export function WaitingOn({
  runId,
  pairings,
  entrants,
  canChase,
}: {
  runId: string;
  /** The latest round's pairings. */
  pairings: readonly PostedRunPairing[];
  entrants: readonly RunEntrant[];
  canChase: boolean;
}) {
  const played = pairings.filter((p) => p.p2EntrantId !== null);
  const missing = played.filter((p) => p.status !== "confirmed");
  if (played.length === 0) return null;
  const name = new Map(entrants.map((e) => [e.id, e.displayName]));

  return (
    <div className="mt-4 border-t border-ink-200 pt-3 text-sm dark:border-ink-800">
      <p className="font-medium">
        {played.length - missing.length} of {played.length} results in
      </p>
      {missing.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {missing.map((pairing) => (
            <li key={pairing.id} className="flex items-center justify-between gap-3">
              <span>
                Table {pairing.table}: {name.get(pairing.p1EntrantId)} vs{" "}
                {name.get(pairing.p2EntrantId ?? "")}
                <span className="ml-1.5 text-xs text-ink-500">
                  {pairing.status === "reported" ? "to confirm" : "not reported"}
                </span>
              </span>
              {canChase && (
                <form action={chaseResultAction}>
                  <input type="hidden" name="runId" value={runId} />
                  <input type="hidden" name="pairingId" value={pairing.id} />
                  <button className={QUIET}>Chase</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
