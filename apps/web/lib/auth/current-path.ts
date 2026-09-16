import { headers } from "next/headers";

import { DEFAULT_NEXT, safeNextPath } from "./next-path";
import { CURRENT_PATH_HEADER } from "./path-header";

/**
 * The path this render is for.
 *
 * Next gives a Server Component no way to ask what URL it is rendering, and a
 * guard that intercepts someone on their way to `/dashboard/format` has to
 * remember where they were going. `proxy.ts` puts it here on every matched
 * request, overwriting whatever the browser sent under the same name.
 */
export async function currentPath(): Promise<string> {
  const store = await headers();
  // Sanitised like any other input: this arrives in a header, and a header is
  // only as trustworthy as the last thing that touched it.
  return safeNextPath(store.get(CURRENT_PATH_HEADER), DEFAULT_NEXT);
}
