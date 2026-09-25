/**
 * Creates `apps/web/.env.local` from `.env.example` when there is none.
 *
 * Never overwrites: an existing file may hold provider credentials the example
 * does not. The example's keys are the Supabase CLI's published local demo
 * keys, so a copy is a working configuration as it stands.
 */
import { copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "../apps/web");
const local = resolve(web, ".env.local");

if (!existsSync(local)) {
  copyFileSync(resolve(web, ".env.example"), local);
  console.log("apps/web/.env.local written from apps/web/.env.example");
}
