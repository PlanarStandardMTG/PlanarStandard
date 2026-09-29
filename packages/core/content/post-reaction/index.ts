import type { PostReaction, PostReactionCounts } from "@ps/contracts";

/** The reactions a post offers, in the order they are shown: a thumbs up alone (E20.49). */
export const POST_REACTIONS = ["thumbs_up"] as const satisfies readonly PostReaction[];

export function isPostReaction(value: unknown): value is PostReaction {
  return (POST_REACTIONS as readonly unknown[]).includes(value);
}

/** Every reaction with its count, zeros filled in. Unknown kinds are dropped. */
export function tallyReactions(
  rows: readonly { readonly reaction: string; readonly total: number }[],
): PostReactionCounts {
  const counts = Object.fromEntries(POST_REACTIONS.map((r) => [r, 0])) as Record<
    PostReaction,
    number
  >;
  for (const row of rows) {
    if (isPostReaction(row.reaction)) counts[row.reaction] += row.total;
  }
  return counts;
}

/**
 * What a click does to the member's reaction: the same one again takes it back,
 * another one replaces it.
 */
export function toggledReaction(
  current: PostReaction | null,
  clicked: PostReaction,
): PostReaction | null {
  return current === clicked ? null : clicked;
}
