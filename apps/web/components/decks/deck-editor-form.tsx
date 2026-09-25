"use client";

import type { DeckFormat } from "@ps/contracts";
import { DECK_NAME_MAX, DECKLIST_MAX, type DeckImportProblem, type UnknownCard } from "@ps/core";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { checkDraft, saveDeck, type DraftCheck, type SaveState } from "@/app/decks/actions";
import { FORMAT_LABELS } from "@/components/decks/format-labels";

/**
 * Write or edit a deck (E20.28, E20.30). The list is checked against its format
 * as the member types, and a deck that is not legal still saves once they say
 * so — a brew is still a deck. The server action decides both; this component
 * only keeps the list from being lost on the way back.
 */
const FIELD =
  "mt-1.5 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm " +
  "focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950";

const BUTTON =
  "rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 " +
  "disabled:opacity-60 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-white";

const QUIET_BUTTON =
  "rounded-lg border border-ink-300 px-4 py-2 text-sm text-ink-700 hover:border-ink-500 " +
  "dark:border-ink-700 dark:text-ink-300";

const VISIBILITY = [
  { value: "public", label: "Public", hint: "Listed on the site." },
  { value: "unlisted", label: "Unlisted", hint: "Anyone with the link." },
  { value: "private", label: "Private", hint: "Only you." },
] as const;

const EXAMPLE = "4 Stock Up\n4 Spell Pierce\n12 Island\n…\n\nSideboard\n2 Negate";

/** How long typing has to pause before the list is checked. */
const CHECK_AFTER_MS = 500;

function describe(problem: DeckImportProblem): string {
  switch (problem.code) {
    case "empty":
      return problem.field === "name" ? "Give the deck a name." : "Paste a decklist.";
    case "long":
      return problem.field === "name"
        ? `Keep the name under ${DECK_NAME_MAX} characters.`
        : `That list is over ${DECKLIST_MAX.toLocaleString()} characters.`;
    case "invalid":
      return problem.field === "format" ? "Choose a format." : "Choose who can see the deck.";
    case "unparsed-line":
      return `Line ${problem.lineNumber}: couldn’t read “${problem.line}”. Lines look like “4 Card Name”.`;
  }
}

function describeUnknown(card: UnknownCard): string {
  const hint =
    card.suggestions.length > 0
      ? ` Did you mean ${card.suggestions.map((s) => `“${s}”`).join(" or ")}?`
      : "";
  return `Line ${card.lineNumber}: we don’t know a card called “${card.name}”.${hint}`;
}

const sentence = (message: string) => message.charAt(0).toUpperCase() + message.slice(1) + ".";

/** Legality issues, less the unknown names, which are listed with their suggestions instead. */
function legalityIssues(check: DraftCheck): string[] {
  if (check.verdict === null) return [];
  return [...check.verdict.deckIssues, ...check.verdict.cardIssues]
    .filter((issue) => issue.code !== "unresolved_name")
    .map((issue) => sentence(issue.message));
}

export interface DeckDraft {
  readonly name: string;
  readonly visibility: string;
  readonly format: DeckFormat;
  readonly decklist: string;
}

const BLANK: DeckDraft = {
  name: "",
  visibility: "public",
  format: "planar_standard",
  decklist: "",
};

export function DeckEditorForm({
  initial = BLANK,
  parentId = null,
}: {
  initial?: DeckDraft;
  /** The version being edited; the save becomes its successor. */
  parentId?: string | null;
}) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveDeck, {
    problems: [],
    confirm: null,
    error: null,
  });
  const [name, setName] = useState(initial.name);
  const [visibility, setVisibility] = useState(initial.visibility);
  const [format, setFormat] = useState<DeckFormat>(initial.format);
  const [decklist, setDecklist] = useState(initial.decklist);
  const [check, setCheck] = useState<DraftCheck | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (decklist.trim() === "") {
      setCheck(null);
      return;
    }
    let current = true;
    const timer = setTimeout(() => {
      void checkDraft(format, decklist).then((result) => {
        if (current) setCheck(result);
      });
    }, CHECK_AFTER_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [format, decklist]);

  useEffect(() => {
    if (state.confirm !== null) dialogRef.current?.showModal();
  }, [state]);

  // Submitted by hand rather than by `action` alone: React resets a form after
  // its action runs, which unchecks the controlled visibility radio on a
  // failed save. `action` stays for a submit without JavaScript.
  const submit = (confirmed: boolean) => {
    if (formRef.current === null) return;
    const data = new FormData(formRef.current);
    if (confirmed) data.set("confirmed", "yes");
    startTransition(() => action(data));
  };
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit(false);
  };

  const about = (field: DeckImportProblem["field"]) =>
    state.problems.filter((p) => p.field === field).map(describe);

  return (
    <form ref={formRef} action={action} onSubmit={onSubmit} className="space-y-6">
      {parentId !== null && <input type="hidden" name="parent" value={parentId} />}

      <div className="grid gap-6 sm:grid-cols-[1fr_14rem]">
        <div>
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={DECK_NAME_MAX}
            placeholder="Azorius Control"
            className={FIELD}
          />
          <Problems messages={about("name")} />
        </div>
        <div>
          <label htmlFor="format" className="text-sm font-medium">
            Format
          </label>
          <select
            id="format"
            name="format"
            value={format}
            onChange={(e) => setFormat(e.target.value as DeckFormat)}
            className={FIELD}
          >
            {Object.entries(FORMAT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Problems messages={about("format")} />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Who can see it</legend>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
          {VISIBILITY.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-ink-300 px-3 py-2 text-sm has-checked:border-eclipse-500 dark:border-ink-700"
            >
              <input
                type="radio"
                name="visibility"
                value={option.value}
                checked={visibility === option.value}
                onChange={() => setVisibility(option.value)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{option.label}</span>
                <span className="block text-xs text-ink-500 dark:text-ink-400">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <Problems messages={about("visibility")} />
      </fieldset>

      <div>
        <label htmlFor="decklist" className="text-sm font-medium">
          Decklist
        </label>
        <p className="text-xs text-ink-500 dark:text-ink-400">
          One card per line, quantity first. A line reading “Sideboard” starts the sideboard. Set
          codes like “(DFT) 67” are fine and optional.
        </p>
        <textarea
          id="decklist"
          name="decklist"
          value={decklist}
          onChange={(e) => setDecklist(e.target.value)}
          rows={18}
          spellCheck={false}
          placeholder={EXAMPLE}
          className={`${FIELD} font-mono`}
        />
        <Problems messages={about("decklist")} />
        {check !== null && <CheckPanel format={format} check={check} />}
      </div>

      {state.error !== null && <Problems messages={[state.error]} />}

      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? "Saving…" : parentId === null ? "Save deck" : "Save new version"}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="confirm-title"
        className="m-auto w-full max-w-md rounded-xl border border-ink-200 bg-white p-6 text-ink-900 backdrop:bg-black/40 dark:border-ink-800 dark:bg-ink-950 dark:text-ink-100"
      >
        <h2 id="confirm-title" className="font-semibold">
          {state.confirm?.verdict?.legal === false
            ? `This deck isn’t legal in ${FORMAT_LABELS[format]}`
            : "Some cards weren’t recognised"}
        </h2>
        {state.confirm !== null && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-700 dark:text-ink-300">
            {[
              ...legalityIssues(state.confirm),
              ...state.confirm.unknownCards.map(describeUnknown),
            ].map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-ink-600 dark:text-ink-400">Save it anyway?</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => dialogRef.current?.close()} className={QUIET_BUTTON}>
            Keep editing
          </button>
          <button
            type="button"
            onClick={() => {
              dialogRef.current?.close();
              submit(true);
            }}
            className={BUTTON}
          >
            Save anyway
          </button>
        </div>
      </dialog>
    </form>
  );
}

/** The list against its format, as it stands — kept current while the member types. */
function CheckPanel({ format, check }: { format: DeckFormat; check: DraftCheck }) {
  const label = FORMAT_LABELS[format];
  const unreadable = check.problems.map(describe);
  const issues = legalityIssues(check);
  const unknown = check.unknownCards.map(describeUnknown);

  return (
    <div aria-live="polite" className="mt-3 space-y-2 text-sm">
      {check.verdict === null ? (
        <p className="rounded-lg border border-ink-200 px-3 py-2 text-ink-600 dark:border-ink-800 dark:text-ink-400">
          No version of {label} is in force, so this deck can’t be checked yet.
        </p>
      ) : check.verdict.legal ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          <span aria-hidden="true">✓</span> Legal in {label}
          {format === "kitchen_table" && " — anything goes."}
        </p>
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          <p className="font-medium">
            <span aria-hidden="true">✗</span> Not legal in {label}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {(issues.length > 0 ? issues : ["Some cards aren’t in the card pool."]).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
      {unknown.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-medium">
            {format === "kitchen_table"
              ? "Not in our card data — these save without images"
              : "Not in the card pool"}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {unknown.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      {unreadable.length > 0 && <Problems messages={unreadable} />}
    </div>
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
