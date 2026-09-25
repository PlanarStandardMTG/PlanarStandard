import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { loadCardIndex } from "@ps/cards";
import type { CardIndex } from "@ps/contracts";

/**
 * The card index, for the site. `@ps/cards` memoizes it per process.
 *
 * From `cwd`, like `content/pages/`: inside Next a module's own URL is a build
 * chunk, not its source file. `next.config.ts` traces the directory.
 */
export function cardIndex(): CardIndex {
  return loadCardIndex(pathToFileURL(`${resolve(process.cwd(), "..", "..", "data", "cards")}/`));
}
