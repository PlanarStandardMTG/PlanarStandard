"use client";

import { useActionState } from "react";

import { codeSignInAction, type CodeState } from "@/app/play/sign-in/actions";

import { PRIMARY, QUIET } from "./button";
import { PlayNotice } from "./notice";

const FIELD =
  "mt-1.5 w-full rounded-lg border border-ink-300 bg-paper px-3 py-2.5 text-base " +
  "focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950";

const START: CodeState = { step: "email", email: "", error: null };

/** Email first, then the code from that email, without leaving the page (E26.24). */
export function CodeSignIn({ next }: { next: string }) {
  const [state, act, pending] = useActionState(codeSignInAction, START);

  if (state.step === "email") {
    return (
      <form action={act} className="space-y-4">
        {state.error !== null && <PlayNotice tone="warn">{state.error}</PlayNotice>}
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={state.email}
            className={FIELD}
          />
        </div>
        <button className={`${PRIMARY} w-full`} disabled={pending}>
          Email me a code
        </button>
      </form>
    );
  }

  return (
    <form action={act} className="space-y-4">
      {state.error !== null && <PlayNotice tone="warn">{state.error}</PlayNotice>}
      <p className="text-sm text-ink-600 dark:text-ink-400">Code sent to {state.email}.</p>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="code" className="text-sm font-medium">
          Code
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          className={`${FIELD} font-mono tracking-[0.3em]`}
        />
      </div>
      <button name="intent" value="verify" className={`${PRIMARY} w-full`} disabled={pending}>
        Sign in
      </button>
      <div className="flex justify-between">
        <button name="intent" value="send" className={QUIET} disabled={pending}>
          Resend
        </button>
        <a href={`/play/sign-in?next=${encodeURIComponent(next)}`} className={QUIET}>
          Change email
        </a>
      </div>
    </form>
  );
}
