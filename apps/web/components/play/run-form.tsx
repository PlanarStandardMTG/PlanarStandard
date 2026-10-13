"use client";

import type { FormatVersion, Run } from "@ps/contracts";
import { MAX_SWISS_ROUNDS, MAX_TOP_CUT, RUN_NAME_MAX_LENGTH, suggestRounds } from "@ps/core";
import { useState } from "react";

import { useHydrated } from "@/components/ui/hydrated";

const FIELD =
  "mt-1.5 w-full rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm " +
  "focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950";

/** `2026-10-17T19:00` in the browser's zone, as a `datetime-local` field wants it. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * Creating or editing a run (E26.16). Swiss rounds and the top cut are prefilled from
 * MTR Appendix E for the number of players expected, and follow that number until the
 * organizer types their own (§28). The start time is typed in the organizer's zone and
 * sent as UTC.
 */
export function RunForm({
  run,
  versions,
  structureLocked,
  action,
  submitLabel,
}: {
  run: Run | null;
  versions: readonly FormatVersion[];
  /** Once a run has started, its shape is fixed. */
  structureLocked: boolean;
  action: (form: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const hydrated = useHydrated();
  const initial = run ?? { ...suggestRounds(8), startsAt: null };
  const [expected, setExpected] = useState(8);
  const [structure, setStructure] = useState({
    swissRounds: initial.swissRounds,
    topCut: initial.topCut,
  });
  const [touched, setTouched] = useState(run !== null);
  const [startsAt, setStartsAt] = useState(initial.startsAt ?? "");
  const chosen = new Set(
    run?.formatVersionIds ?? versions.filter((v) => v.isCurrent).map((v) => v.id),
  );

  const follow = (players: number) => {
    setExpected(players);
    if (!touched) setStructure(suggestRounds(players));
  };
  const suggestion = suggestRounds(expected);

  return (
    <form action={action} className="space-y-5">
      {run !== null && <input type="hidden" name="runId" value={run.id} />}
      <div>
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={RUN_NAME_MAX_LENGTH}
          defaultValue={run?.name ?? ""}
          placeholder="Planar Standard Weekly #42"
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="startsLocal" className="text-sm font-medium">
          Starts
        </label>
        <input
          // The local time exists only in the browser, so the field is drawn again there.
          key={hydrated ? "local" : "server"}
          id="startsLocal"
          type="datetime-local"
          disabled={!hydrated}
          defaultValue={hydrated && startsAt !== "" ? toLocalInput(startsAt) : ""}
          onChange={(event) => {
            const date = new Date(event.target.value);
            setStartsAt(Number.isNaN(date.getTime()) ? "" : date.toISOString());
          }}
          className={FIELD}
        />
        <input type="hidden" name="startsAt" value={startsAt} />
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
          In your time zone{hydrated ? `, ${Intl.DateTimeFormat().resolvedOptions().timeZone}` : ""}
          .
        </p>
      </div>

      <div>
        <label htmlFor="description" className="text-sm font-medium">
          Details
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={run?.description ?? ""}
          placeholder="Best of three. Pairings posted here and in Discord."
          className={FIELD}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Format versions</legend>
        <p className="text-xs text-ink-500 dark:text-ink-400">
          Decks are checked against these. The first ticked is the default.
        </p>
        <div className="mt-2 space-y-1.5">
          {versions.map((version) => (
            <label key={version.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="formatVersionId"
                value={version.id}
                defaultChecked={chosen.has(version.id)}
              />
              {version.name}
              {version.isCurrent && <span className="text-xs text-ink-500">(current)</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={structureLocked} className="space-y-3">
        <legend className="text-sm font-medium">Structure</legend>
        {structureLocked ? (
          <p className="text-xs text-ink-500 dark:text-ink-400">
            Fixed once the event has started.
          </p>
        ) : (
          <div>
            <label htmlFor="expected" className="text-xs text-ink-600 dark:text-ink-400">
              Players expected — suggests {suggestion.swissRounds} Swiss round
              {suggestion.swissRounds === 1 ? "" : "s"}
              {suggestion.topCut > 0 ? ` and a top ${suggestion.topCut}` : ", no cut"} (MTR Appendix
              E)
            </label>
            <input
              id="expected"
              type="number"
              min={2}
              max={1000}
              value={expected}
              onChange={(event) => follow(Number(event.target.value) || 0)}
              className={FIELD}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="swissRounds" className="text-sm">
              Swiss rounds
            </label>
            <input
              id="swissRounds"
              name="swissRounds"
              type="number"
              min={0}
              max={MAX_SWISS_ROUNDS}
              required
              value={structure.swissRounds}
              onChange={(event) => {
                setTouched(true);
                setStructure((s) => ({ ...s, swissRounds: Number(event.target.value) }));
              }}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="topCut" className="text-sm">
              Top cut
            </label>
            <input
              id="topCut"
              name="topCut"
              type="number"
              min={0}
              max={MAX_TOP_CUT}
              required
              value={structure.topCut}
              onChange={(event) => {
                setTouched(true);
                setStructure((s) => ({ ...s, topCut: Number(event.target.value) }));
              }}
              className={FIELD}
            />
          </div>
        </div>
        <p className="text-xs text-ink-500 dark:text-ink-400">
          Any numbers work: 0 Swiss rounds is straight single elimination, 0 is no cut.
        </p>
      </fieldset>

      <button
        type="submit"
        className="w-full rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-ink-700 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper"
      >
        {submitLabel}
      </button>
    </form>
  );
}
