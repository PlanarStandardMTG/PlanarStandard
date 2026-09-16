import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** The one place the site's measure is decided. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-5xl px-5 sm:px-8", className)}>{children}</div>;
}
