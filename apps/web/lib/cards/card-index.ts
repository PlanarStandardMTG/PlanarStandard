import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { loadCardDataset, loadCardIndex } from "@ps/cards";
import type { CardIndex } from "@ps/contracts";

/**
 * The card index, for the site. `@ps/cards` memoizes it per process.
 *
 * From `cwd`, like `content/pages/`: inside Next a module's own URL is a build
 * chunk, not its source file. `next.config.ts` traces the directory.
 */
const dataDir = () => pathToFileURL(`${resolve(process.cwd(), "..", "..", "data", "cards")}/`);

export function cardIndex(): CardIndex {
  return loadCardIndex(dataDir());
}

/** The sets the card dataset holds, upper-cased as a format's pool writes them. */
export function cardSetCodes(): readonly string[] {
  return loadCardDataset(dataDir()).meta.setCodes.map((code) => code.toUpperCase());
}
