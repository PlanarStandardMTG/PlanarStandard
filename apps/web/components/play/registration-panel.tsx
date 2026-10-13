import type { Deck, Run, RunEntrant, RunEntrantDeck } from "@ps/contracts";
import Link from "next/link";

import { changeDeckAction, registerAction, withdrawAction } from "@/app/play/runs/actions";
import type { Viewer } from "@/lib/auth/viewer";

import { PRIMARY, QUIET } from "./button";

const FIELD =
  "mt-1.5 w-full rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm " +
  "focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950";

/** A saved deck to pick, or a list to paste. One of the two is needed. */
function DeckChoice({
  decks,
  current,
}: {
  decks: readonly Deck[];
  current: RunEntrantDeck | null;
}) {
  return (
    <div className="space-y-3">
      {decks.length > 0 && (
        <div>
          <label htmlFor="deckId" className="text-sm font-medium">
            One of your decks
          </label>
          <select id="deckId" name="deckId" defaultValue={current?.deckId ?? ""} className={FIELD}>
            <option value="">— paste a list instead —</option>
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="decklist" className="text-sm font-medium">
          {decks.length > 0 ? "Or paste a list" : "Your list"}
        </label>
        <textarea
          id="decklist"
          name="decklist"
          rows={8}
          defaultValue={current?.deckId === null ? current.decklistText : ""}
          placeholder={"4 Llanowar Elves\n20 Forest\n\nSideboard\n2 Duress"}
          className={`${FIELD} font-mono`}
        />
      </div>
    </div>
  );
}

/**
 * Registering for a run, changing the deck, and withdrawing (E26.17). Open only while
 * registration is; the deck locks when the run starts (ADR 013).
 */
export function RegistrationPanel({
  run,
  viewer,
  entrant,
  deck,
  decks,
}: {
  run: Run;
  viewer: Viewer | null;
  entrant: RunEntrant | null;
  deck: RunEntrantDeck | null;
  decks: readonly Deck[];
}) {
  if (run.state !== "registration" && entrant === null) return null;

  if (viewer === null) {
    return (
      <section className="rounded-xl border border-ink-200 p-4 text-sm dark:border-ink-800">
        <Link
          href={`/play/sign-in?next=${encodeURIComponent(`/play/runs/${run.id}`)}`}
          className="font-medium text-eclipse-700 dark:text-eclipse-400"
        >
          Sign in to register
        </Link>
      </section>
    );
  }

  if (entrant !== null) {
    const open = run.state === "registration";
    return (
      <section className="rounded-xl border border-ink-200 p-4 dark:border-ink-800">
        <h2 className="text-sm font-semibold">You are registered</h2>
        <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
          {deck === null
            ? "No deck yet."
            : deck.isLegal === false
              ? "Your deck is not legal in this run's format versions. The organizer can see that."
              : open
                ? "Your deck is in. You can change it until the run starts."
                : "Your deck is locked for this run."}
        </p>
        {open && (
          <>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium">Change deck</summary>
              <form action={changeDeckAction} className="mt-3 space-y-3">
                <input type="hidden" name="runId" value={run.id} />
                <input type="hidden" name="entrantId" value={entrant.id} />
                <DeckChoice decks={decks} current={deck} />
                <button className={PRIMARY}>Save deck</button>
              </form>
            </details>
            <form action={withdrawAction} className="mt-3">
              <input type="hidden" name="runId" value={run.id} />
              <input type="hidden" name="entrantId" value={entrant.id} />
              <button className={QUIET}>Withdraw</button>
            </form>
          </>
        )}
      </section>
    );
  }

  if (viewer.profile.handle === null) {
    return (
      <section className="rounded-xl border border-ink-200 p-4 text-sm dark:border-ink-800">
        To register, set a handle on{" "}
        <Link
          href="/dashboard/profile"
          className="font-medium text-eclipse-700 dark:text-eclipse-400"
        >
          your profile
        </Link>
        : your matches here are recorded under it.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-ink-200 p-4 dark:border-ink-800">
      <h2 className="text-sm font-semibold">Register as {viewer.profile.handle}</h2>
      <form action={registerAction} className="mt-3 space-y-3">
        <input type="hidden" name="runId" value={run.id} />
        <DeckChoice decks={decks} current={null} />
        <button className={PRIMARY}>Register</button>
      </form>
    </section>
  );
}
