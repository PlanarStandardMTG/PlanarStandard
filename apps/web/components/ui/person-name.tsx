import { canViewHistory } from "@ps/core";
import Link from "next/link";
import type { ReactNode } from "react";

import { currentViewer } from "@/lib/auth/viewer";
import { cn } from "@/lib/cn";
import { personHref, type Person } from "@/lib/people/member-href";

/**
 * A member's or a player's name. A link to their history for a writer or above
 * (E20.42); plain text for everyone else, styled exactly as it would be anyway,
 * so nobody below writer can tell a name leads anywhere.
 */
export async function PersonName({
  person,
  children,
  className,
}: {
  person: Person | null;
  children: ReactNode;
  className?: string;
}) {
  const viewer = await currentViewer();
  if (person === null || !canViewHistory(viewer?.profile ?? null)) {
    return className === undefined ? (
      <>{children}</>
    ) : (
      <span className={className}>{children}</span>
    );
  }

  return (
    <Link href={personHref(person)} className={cn("underline-offset-2 hover:underline", className)}>
      {children}
    </Link>
  );
}
