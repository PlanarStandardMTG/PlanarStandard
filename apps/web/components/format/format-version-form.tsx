"use client";

import type { CardRuling } from "@ps/contracts";
import { FORMAT_NAME_MAX, type CardRuleInput, type FormatDraftProblem } from "@ps/core";
import { startTransition, useActionState, useState, type FormEvent } from "react";

import { saveFormat, type FormatSaveState } from "@/app/admin/formats/actions";

/**
 * One format version's fields, legal sets, deck limits and card rules (E20.33).
 * A client component so a failed save keeps what the admin typed; the checking
 * is the server action's.
 */
const FIELD =
  "mt-1.5 w-full rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm " +
  "focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950";

const BUTTON =
  "rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 " +
  "disabled:opacity-60 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper";

const RULINGS: ReadonlyArray<{ readonly value: CardRuling; readonly label: string }> = [
  { value: "banned", label: "Banned" },
  { value: "restricted", label: "Restricted" },
  { value: "legal_exception", label: "Legal exception" },
];

export interface FormatFormValues {
  readonly name: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly notes: string;
  readonly isCurrent: boolean;
  readonly legalSets: readonly string[];
  readonly minMaindeck: string;
  readonly maxMaindeck: string;
  readonly maxSideboard: string;
  readonly maxCopies: string;
  readonly singleton: boolean;
  readonly cardRules: readonly CardRuleInput[];
}

const BLANK_RULE: CardRuleInput = { cardName: "", ruling: "banned", reason: "", effectiveFrom: "" };

function describe(problem: FormatDraftProblem): string {
  switch (problem.field) {
    case "name":
      return problem.code === "empty"
        ? "Give the version a name."
        : `Keep the name under ${FORMAT_NAME_MAX} characters.`;
    case "effectiveFrom":
      return "Choose the date this version takes effect.";
    case "effectiveTo":
      return problem.code === "invalid"
        ? "That end date isn’t a date."
        : "The end date is before the start.";
    case "legalSets":
      return problem.code === "empty"
        ? "Choose at least one legal set."
        : `“${problem.set}” isn’t a set code.`;
    case "maxMaindeck":
      return problem.code === "below-minimum"
        ? "The maximum maindeck is below the minimum."
        : "Maximum maindeck must be a whole number of at least 1, or blank for none.";
    case "minMaindeck":
      return "Minimum maindeck must be a whole number of at least 1.";
    case "maxSideboard":
      return "Maximum sideboard must be a whole number.";
    case "maxCopies":
      return "Copies allowed must be a whole number of at least 1.";
    case "cardRules": {
      const row = `Card rule ${problem.row + 1}`;
      switch (problem.code) {
        case "unknown-card": {
          const hint =
            problem.suggestions.length > 0
              ? ` Did you mean ${problem.suggestions.map((s) => `“${s}”`).join(" or ")}?`
              : "";
          return `${row}: no card called “${problem.name}”.${hint}`;
        }
        case "duplicate":
          return `${row}: ${problem.name} already has a rule.`;
        case "invalid-ruling":
          return `${row}: choose a ruling.`;
        case "invalid-date":
          return `${row}: that date isn’t a date.`;
      }
    }
  }
}

export function FormatVersionForm({
  id,
  initial,
  knownSets,
}: {
  /** Null for a new version. */
  id: string | null;
  initial: FormatFormValues;
  /** The sets the card dataset holds, offered as checkboxes. */
  knownSets: readonly string[];
}) {
  const [state, action, pending] = useActionState<FormatSaveState, FormData>(saveFormat, {
    problems: [],
  });
  const [values, setValues] = useState(initial);
  const [rules, setRules] = useState<readonly CardRuleInput[]>(
    initial.cardRules.length > 0 ? initial.cardRules : [BLANK_RULE],
  );
  const [sets, setSets] = useState<ReadonlySet<string>>(
    new Set(initial.legalSets.filter((s) => knownSets.includes(s))),
  );
  const [otherSets, setOtherSets] = useState(
    initial.legalSets.filter((s) => !knownSets.includes(s)).join(", "),
  );

  const set = <K extends keyof FormatFormValues>(key: K, value: FormatFormValues[K]) =>
    setValues((previous) => ({ ...previous, [key]: value }));
  const setRule = (row: number, change: Partial<CardRuleInput>) =>
    setRules((previous) => previous.map((rule, i) => (i === row ? { ...rule, ...change } : rule)));

  // Submitted by hand: React resets a form after its action runs, which would
  // clear the controlled checkboxes on a failed save.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };

  const about = (field: FormatDraftProblem["field"]) =>
    state.problems.filter((p) => p.field === field).map(describe);

  return (
    <form action={action} onSubmit={submit} className="space-y-8">
      {id !== null && <input type="hidden" name="id" value={id} />}

      <section className="space-y-4">
        <div>
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={FORMAT_NAME_MAX}
            placeholder="Planar Standard — Season III"
            className={FIELD}
          />
          <Problems messages={about("name")} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="effective_from" className="text-sm font-medium">
              Takes effect
            </label>
            <input
              id="effective_from"
              name="effective_from"
              type="date"
              value={values.effectiveFrom}
              onChange={(e) => set("effectiveFrom", e.target.value)}
              className={FIELD}
            />
            <Problems messages={about("effectiveFrom")} />
          </div>
          <div>
            <label htmlFor="effective_to" className="text-sm font-medium">
              Ends <span className="font-normal text-ink-500">(optional)</span>
            </label>
            <input
              id="effective_to"
              name="effective_to"
              type="date"
              value={values.effectiveTo}
              onChange={(e) => set("effectiveTo", e.target.value)}
              className={FIELD}
            />
            <Problems messages={about("effectiveTo")} />
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-ink-300 px-3 py-2 text-sm has-checked:border-eclipse-500 dark:border-ink-700">
          <input
            type="checkbox"
            name="is_current"
            checked={values.isCurrent}
            onChange={(e) => set("isCurrent", e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="font-medium">The version in force</span>
            <span className="block text-xs text-ink-500 dark:text-ink-400">
              Decks and the rules page check against this one. Saving takes it from whichever
              version has it now.
            </span>
          </span>
        </label>

        <div>
          <label htmlFor="notes" className="text-sm font-medium">
            Notes <span className="font-normal text-ink-500">(Markdown, optional)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            className={FIELD}
          />
        </div>
      </section>

      <fieldset>
        <legend className="text-sm font-medium">Legal sets</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {knownSets.map((code) => (
            <label
              key={code}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-300 px-3 py-1.5 font-mono text-sm has-checked:border-eclipse-500 dark:border-ink-700"
            >
              <input
                type="checkbox"
                name="set"
                value={code}
                checked={sets.has(code)}
                onChange={() =>
                  setSets((previous) => {
                    const next = new Set(previous);
                    if (next.has(code)) next.delete(code);
                    else next.add(code);
                    return next;
                  })
                }
              />
              {code}
            </label>
          ))}
        </div>
        <label htmlFor="other_sets" className="mt-3 block text-xs text-ink-500 dark:text-ink-400">
          Other set codes, comma-separated — for a set the card data doesn’t hold yet
        </label>
        <input
          id="other_sets"
          name="other_sets"
          value={otherSets}
          onChange={(e) => setOtherSets(e.target.value)}
          className={`${FIELD} font-mono`}
        />
        <Problems messages={about("legalSets")} />
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Deck limits</legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-4">
          {(
            [
              ["min_maindeck", "minMaindeck", "Minimum maindeck"],
              ["max_maindeck", "maxMaindeck", "Maximum maindeck"],
              ["max_sideboard", "maxSideboard", "Maximum sideboard"],
              ["max_copies", "maxCopies", "Copies of a card"],
            ] as const
          ).map(([name, key, label]) => (
            <div key={name}>
              <label htmlFor={name} className="text-xs text-ink-600 dark:text-ink-400">
                {label}
              </label>
              <input
                id={name}
                name={name}
                inputMode="numeric"
                value={values[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={key === "maxMaindeck" ? "No limit" : undefined}
                className={FIELD}
              />
            </div>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="singleton"
            checked={values.singleton}
            onChange={(e) => set("singleton", e.target.checked)}
          />
          Singleton — one copy of each card except basic lands
        </label>
        <Problems
          messages={[
            ...about("minMaindeck"),
            ...about("maxMaindeck"),
            ...about("maxSideboard"),
            ...about("maxCopies"),
          ]}
        />
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Card rules</legend>
        <p className="text-xs text-ink-500 dark:text-ink-400">
          Bans, restrictions, and cards legal despite their set. Blank rows are ignored.
        </p>
        <div className="mt-2 space-y-2">
          {rules.map((rule, row) => (
            <div
              key={row}
              className="grid gap-2 rounded-lg border border-ink-200 p-2 sm:grid-cols-[1.4fr_1fr_1.4fr_1fr_auto] dark:border-ink-800"
            >
              <input
                name="rule_card"
                aria-label={`Card rule ${row + 1}: card name`}
                value={rule.cardName}
                onChange={(e) => setRule(row, { cardName: e.target.value })}
                placeholder="Card name"
                className={`${FIELD} mt-0`}
              />
              <select
                name="rule_ruling"
                aria-label={`Card rule ${row + 1}: ruling`}
                value={rule.ruling}
                onChange={(e) => setRule(row, { ruling: e.target.value })}
                className={`${FIELD} mt-0`}
              >
                {RULINGS.map((ruling) => (
                  <option key={ruling.value} value={ruling.value}>
                    {ruling.label}
                  </option>
                ))}
              </select>
              <input
                name="rule_reason"
                aria-label={`Card rule ${row + 1}: reason`}
                value={rule.reason}
                onChange={(e) => setRule(row, { reason: e.target.value })}
                placeholder="Reason (optional)"
                className={`${FIELD} mt-0`}
              />
              <input
                name="rule_from"
                type="date"
                aria-label={`Card rule ${row + 1}: effective from`}
                value={rule.effectiveFrom}
                onChange={(e) => setRule(row, { effectiveFrom: e.target.value })}
                className={`${FIELD} mt-0`}
              />
              <button
                type="button"
                onClick={() => setRules((previous) => previous.filter((_, i) => i !== row))}
                aria-label={`Remove card rule ${row + 1}`}
                className="rounded-lg px-2 text-sm text-ink-500 hover:text-red-700 dark:hover:text-red-400"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRules((previous) => [...previous, BLANK_RULE])}
          className="mt-2 text-sm text-ink-600 underline dark:text-ink-400"
        >
          Add a card rule
        </button>
        <Problems messages={about("cardRules")} />
      </fieldset>

      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? "Saving…" : id === null ? "Create version" : "Save version"}
      </button>
    </form>
  );
}

function Problems({ messages }: { messages: readonly string[] }) {
  if (messages.length === 0) return null;
  return (
    <ul role="alert" className="mt-2 space-y-1 text-sm text-red-700 dark:text-red-400">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}
