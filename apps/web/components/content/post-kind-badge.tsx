import type { PostKind } from "@ps/contracts";

import { Badge } from "@/components/ui/badge";

/**
 * The one place a post's kind is turned into a label.
 *
 * Official posts get the accent so the format's own voice is distinguishable at
 * a glance in a mixed feed; community posts stay quiet, because in a mixed feed
 * most of them are community posts and badging them all would badge nothing.
 */
export function PostKindBadge({ kind }: { kind: PostKind }) {
  return kind === "official" ? (
    <Badge variant="accent">Official</Badge>
  ) : (
    <Badge variant="outline">Community</Badge>
  );
}
