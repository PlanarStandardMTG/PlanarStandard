import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * `next/link` with prefetching off (E16.18).
 *
 * Every route here renders per request, so a prefetch only fetches the route
 * tree and a click still waits on the server, yet each link that scrolls into
 * view is a function invocation, proxy included. Pass `prefetch` to opt back in.
 */
export function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}
