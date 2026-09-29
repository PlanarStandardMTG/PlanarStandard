"use client";

import type { PostReaction, PostReactionCounts } from "@ps/contracts";
import { POST_REACTIONS, toggledReaction } from "@ps/core";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";

import { cn } from "@/lib/cn";

const LABELS: Readonly<Record<PostReaction, string>> = { thumbs_up: "Thumbs up" };

export type ReactionAccess = "member" | "signed-out" | "banned";

/**
 * A thumbs up with its count (E20.41, E20.49). Clicking it again takes it back.
 *
 * The action arrives as a prop, like `TournamentLines`'. Signed out, each
 * button is a link to sign in and come back.
 */
export function ReactionBar({
  counts,
  mine,
  access,
  loginHref,
  react,
}: {
  counts: PostReactionCounts;
  mine: PostReaction | null;
  access: ReactionAccess;
  loginHref: string;
  react: (reaction: PostReaction | null) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setOptimistic] = useOptimistic(
    { counts, mine },
    (current, next: PostReaction | null) => {
      const shifted = { ...current.counts };
      if (current.mine !== null) shifted[current.mine] -= 1;
      if (next !== null) shifted[next] += 1;
      return { counts: shifted, mine: next };
    },
  );

  const click = (reaction: PostReaction) => {
    const next = toggledReaction(state.mine, reaction);
    startTransition(async () => {
      setOptimistic(next);
      await react(next);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      {POST_REACTIONS.map((reaction) => {
        const chosen = state.mine === reaction;
        const count = state.counts[reaction];
        const label = `${LABELS[reaction]}, ${count}${chosen ? ", your reaction" : ""}`;
        const className = cn(
          "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm tabular-nums transition-colors",
          chosen
            ? "border-eclipse-500 bg-eclipse-500/10 text-ink-900 dark:text-ink-100"
            : "border-ink-200 text-ink-600 hover:border-eclipse-500/60 dark:border-ink-800 dark:text-ink-400",
          access === "banned" && "cursor-not-allowed opacity-60",
        );
        const content = (
          <>
            <span aria-hidden="true" className="text-base leading-none">
              👍
            </span>
            <span>{count}</span>
          </>
        );

        return access === "signed-out" ? (
          <Link
            key={reaction}
            href={loginHref}
            className={className}
            aria-label={label}
            title="Sign in to react"
          >
            {content}
          </Link>
        ) : (
          <button
            key={reaction}
            type="button"
            className={className}
            aria-label={label}
            aria-pressed={chosen}
            disabled={access === "banned"}
            onClick={() => click(reaction)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
