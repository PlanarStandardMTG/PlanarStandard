import type { FormatVersionDetail } from "@ps/contracts";
import { getCurrentFormatDetail } from "@ps/db";

import { load, type Loaded } from "@/lib/load";
import { createPublicClient } from "@/lib/supabase/server";

/**
 * The format in force, for the two info-page components that publish it.
 *
 * A thin coordinator: open a client, ask the repo, let `load` turn a throw into
 * a state the component can render. Nothing here decides anything about the
 * format — that is what makes it safe for a B&R announcement to be rows.
 */
export async function loadCurrentFormat(): Promise<Loaded<FormatVersionDetail | null>> {
  return await load(async () => await getCurrentFormatDetail(createPublicClient()));
}
