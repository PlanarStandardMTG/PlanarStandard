import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/cn";

/**
 * The bits every auth page is made of (E16.9).
 *
 * Five pages — sign in, sign up, forgot, check email, new password — that all
 * have to feel like one door. Sharing the frame is what stops them drifting
 * apart as each gets edited on its own.
 */

export function AuthShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-md">
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">{title}</h1>
        {intro !== undefined && <p className="mt-2 text-ink-600 dark:text-ink-400">{intro}</p>}
        {children}
      </div>
    </Container>
  );
}

/** A problem, or a confirmation. Announced either way, so a screen reader hears it. */
export function Notice({ tone, children }: { tone: "warn" | "good"; children: ReactNode }) {
  return (
    <p
      role={tone === "warn" ? "alert" : "status"}
      className={cn(
        "mt-6 rounded-lg border px-4 py-3 text-sm",
        tone === "warn"
          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
          : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
      )}
    >
      {children}
    </p>
  );
}

export const FIELD_CLASS =
  "mt-1.5 w-full rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm " +
  "focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950";

export function Field({
  label,
  name,
  type = "text",
  hint,
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
  hint?: string;
} & Omit<React.ComponentPropsWithoutRef<"input">, "name" | "type" | "className">) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input id={name} name={name} type={type} className={FIELD_CLASS} {...rest} />
      {hint !== undefined && <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{hint}</p>}
    </div>
  );
}

export function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="w-full rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-ink-700 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper"
    >
      {children}
    </button>
  );
}

/** A labelled rule, for separating one way in from another. */
export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-ink-200 dark:bg-ink-800" />
      <span className="text-xs tracking-wide text-ink-500 uppercase dark:text-ink-400">
        {children}
      </span>
      <span className="h-px flex-1 bg-ink-200 dark:bg-ink-800" />
    </div>
  );
}

export { Card };
