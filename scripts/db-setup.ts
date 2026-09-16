/**
 * Materialises the gitignored `supabase/` working directory from the committed
 * sources in `packages/db`.
 *
 * `supabase/` holds local container state, so it is not in git (§17) — but the
 * CLI insists on finding `config.toml` and `migrations/` there. So the config is
 * committed as a template and the migrations directory is linked, which keeps
 * `packages/db` the single source of truth and means a fresh clone needs one
 * command rather than a page of instructions.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const supabaseDir = resolve(root, "supabase");
const template = resolve(root, "packages/db/supabase.config.toml");
const config = resolve(supabaseDir, "config.toml");
const migrations = resolve(supabaseDir, "migrations");
const source = resolve(root, "packages/db/migrations");
const templates = resolve(supabaseDir, "templates");
const templateSource = resolve(root, "packages/db/templates");

mkdirSync(supabaseDir, { recursive: true });

const desired = readFileSync(template, "utf8");
if (!existsSync(config) || readFileSync(config, "utf8") !== desired) {
  writeFileSync(config, desired);
  console.log("supabase/config.toml written from packages/db/supabase.config.toml");
}

// Relative, so the links survive the repo being cloned to a different path.
function link(at: string, to: string): void {
  const target = relative(supabaseDir, to);
  if (existsSync(at) || lstatSync(at, { throwIfNoEntry: false })) {
    rmSync(at, { recursive: true, force: true });
  }
  symlinkSync(target, at, "dir");
  console.log(`${relative(root, at)} -> ${target}`);
}

link(migrations, source);
// The auth email templates, which `config.toml` names by path (E16.9).
link(templates, templateSource);
