import type { PostedRunPairing, ProfileId } from "@ps/contracts";
import { resultChoices, type ResultChoice } from "@ps/core";

import { confirmResultAction, reportResultAction, setResultAction } from "@/app/play/runs/actions";

import { PRIMARY, SECONDARY } from "./button";
import { gamesText } from "./round-list";

const SELECT =
  "rounded-lg border border-ink-300 bg-paper px-2 py-2 text-sm dark:border-ink-700 dark:bg-ink-950";

/** A choice in words, from the side picking it. */
function label(choice: ResultChoice): string {
  const score =
    choice.drawn > 0
      ? `${choice.won}–${choice.lost}–${choice.drawn}`
      : `${choice.won}–${choice.lost}`;
  if (choice.won === 0 && choice.lost === 0) return `Intentional draw (${score})`;
  if (choice.won > choice.lost) return `Won ${score}`;
  if (choice.won < choice.lost) return `Lost ${score}`;
  return `Drew ${score}`;
}

function Hidden({ runId, pairingId }: { runId: string; pairingId: string }) {
  return (
    <>
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="pairingId" value={pairingId} />
    </>
  );
}

/**
 * What the viewer can do with one pairing's result (E26.20): report it as one of the
 * players, confirm what the other reported, or — as the organizer — enter, overrule
 * or accept it. The database enforces the same rules (0049).
 */
export function ResultControls({
  runId,
  pairing,
  side,
  viewerProfileId,
  manages,
  elimination,
  playing,
  correcting,
  p1Name,
}: {
  runId: string;
  pairing: PostedRunPairing;
  side: "p1" | "p2" | null;
  viewerProfileId: ProfileId | null;
  manages: boolean;
  elimination: boolean;
  /** Players report only while the run is being played. */
  playing: boolean;
  /** The organizer can also correct a finished run, then import it again (E26.21). */
  correcting: boolean;
  p1Name: string;
}) {
  if (pairing.p2EntrantId === null || !(playing || (manages && correcting))) return null;
  const choices = resultChoices(elimination);
  const theirs = pairing.status === "reported" && pairing.reportedBy !== viewerProfileId;
  const reportedText = (() => {
    const games = pairing.games;
    if (games === null) return "";
    const ownWins = side === "p2" ? games.p2Wins : games.p1Wins;
    const ownLosses = side === "p2" ? games.p1Wins : games.p2Wins;
    return label({ code: "", won: ownWins, lost: ownLosses, drawn: games.draws });
  })();

  return (
    <div className="mt-2 space-y-2 pl-9">
      {playing && side !== null && pairing.status !== "confirmed" && (
        <div className="space-y-2">
          {theirs && (
            <form
              action={confirmResultAction}
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <Hidden runId={runId} pairingId={pairing.id} />
              <span>
                Your opponent reported: <strong>{reportedText}</strong> for you.
              </span>
              <button className={PRIMARY}>Confirm</button>
            </form>
          )}
          {pairing.status === "reported" && !theirs && (
            <p className="text-xs text-ink-500">
              You reported {reportedText}. Waiting for your opponent to confirm.
            </p>
          )}
          <form action={reportResultAction} className="flex flex-wrap items-center gap-2">
            <Hidden runId={runId} pairingId={pairing.id} />
            <label className="sr-only" htmlFor={`report-${pairing.id}`}>
              Your result
            </label>
            <select id={`report-${pairing.id}`} name="result" className={SELECT} defaultValue="">
              <option value="" disabled>
                {theirs ? "Report something else…" : "Your result…"}
              </option>
              {choices.map((c) => (
                <option key={c.code} value={c.code}>
                  {label(c)}
                </option>
              ))}
            </select>
            <button className={SECONDARY}>Report</button>
          </form>
        </div>
      )}

      {manages && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-ink-500">
            {pairing.status === "confirmed"
              ? `Overrule (${gamesText(pairing)})`
              : "Organizer: enter result"}
          </summary>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {pairing.status === "reported" && (
              <form action={setResultAction}>
                <Hidden runId={runId} pairingId={pairing.id} />
                <input type="hidden" name="accept" value="1" />
                <button className={PRIMARY}>Accept {gamesText(pairing)}</button>
              </form>
            )}
            <form action={setResultAction} className="flex flex-wrap items-center gap-2">
              <Hidden runId={runId} pairingId={pairing.id} />
              <label className="sr-only" htmlFor={`set-${pairing.id}`}>
                Result for {p1Name}
              </label>
              <select id={`set-${pairing.id}`} name="result" className={SELECT} defaultValue="">
                <option value="" disabled>
                  For {p1Name}…
                </option>
                {choices.map((c) => (
                  <option key={c.code} value={c.code}>
                    {p1Name}: {label(c)}
                  </option>
                ))}
              </select>
              <button className={SECONDARY}>Save</button>
            </form>
          </div>
        </details>
      )}
    </div>
  );
}
