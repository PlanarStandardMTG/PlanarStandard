"use client";

import { DECK_NAME_MAX, DECKLIST_MAX, type DeckImportProblem } from "@ps/core";
import { startTransition, useActionState, useState, type FormEvent } from "react";

import { importDeck, type ImportState } from "@/app/decks/actions";

/**
 * Paste a list, name it, save it (E20.28). A client component only so that a
 * list with one typo is not lost on the way back; the checking is the server
 * action's.
 */
const FIELD =
  "mt-1.5 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm " +
  "focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950";

const VISIBILITY = [
  { value: "public", label: "Public", hint: "Listed on the site." },
  { value: "unlisted", label: "Unlisted", hint: "Anyone with the link." },
  { value: "private", label: "Private", hint: "Only you." },
] as const;

const EXAMPLE = "4 Stock Up\n4 Spell Pierce\n12 Island\n…\n\nSideboard\n2 Negate";

function describe(problem: DeckImportProblem): string {
  switch (problem.code) {
    case "empty":
      return problem.field === "name" ? "Give the deck a name." : "Paste a decklist.";
    case "long":
      return problem.field === "name"
        ? `Keep the name under ${DECK_NAME_MAX} characters.`
        : `That list is over ${DECKLIST_MAX.toLocaleString()} characters.`;
    case "invalid":
      return "Choose who can see the deck.";
    case "unparsed-line":
      return `Line ${problem.lineNumber}: couldn’t read “${problem.line}”. Lines look like “4 Card Name”.`;
    case "unknown-card": {
      const hint =
        problem.suggestions.length > 0
          ? ` Did you mean ${problem.suggestions.map((s) => `“${s}”`).join(" or ")}?`
          : "";
      return `Line ${problem.lineNumber}: no card called “${problem.name}” in the legal sets.${hint}`;
    }
  }
}

export function DeckImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importDeck, {
    problems: [],
  });
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [decklist, setDecklist] = useState("");

  // Submitted by hand rather than by `action` alone: React resets a form after
  // its action runs, which unchecks the controlled visibility radio on a
  // failed import. `action` stays for a submit without JavaScript.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };

  const about = (field: DeckImportProblem["field"]) =>
    state.problems.filter((p) => p.field === field).map(describe);

  return (
    <form action={action} onSubmit={submit} className="space-y-6">
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
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 disabled:opacity-60 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-white"
      >
        {pending ? "Importing…" : "Import deck"}
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
