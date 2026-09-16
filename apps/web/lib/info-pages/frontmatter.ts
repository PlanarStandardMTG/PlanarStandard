import type { InfoPageComponent, InfoPageFrontmatter } from "@ps/contracts";

/**
 * Frontmatter for an MDX info page, parsed and validated against the contract.
 *
 * Deliberately not a YAML parser. The schema is six known keys, so a strict
 * reader that rejects anything it does not recognise is both smaller than a YAML
 * dependency and a better error message: a typo'd key is a build failure naming
 * the key, rather than a page that silently loses its nav entry.
 */

const DELIMITER = "---";

/** The single source of the whitelist at runtime; kept exhaustive by a type-level check below. */
export const INFO_PAGE_COMPONENTS = ["LegalSets", "Banlist", "Chart"] as const;

// If `InfoPageComponent` gains a member, this assignment stops compiling.
const _exhaustive: readonly InfoPageComponent[] = INFO_PAGE_COMPONENTS;
void _exhaustive;

function isInfoPageComponent(value: string): value is InfoPageComponent {
  return (INFO_PAGE_COMPONENTS as readonly string[]).includes(value);
}

export class FrontmatterError extends Error {}

export interface ParsedPage {
  readonly frontmatter: InfoPageFrontmatter;
  readonly body: string;
}

/** Splits a `---`-delimited frontmatter block off the front of a file. */
export function splitFrontmatter(source: string): {
  readonly block: string;
  readonly body: string;
} {
  const text = source.replace(/^﻿/, "");
  const lines = text.split("\n");
  if (lines[0]?.trim() !== DELIMITER) {
    throw new FrontmatterError("missing frontmatter: the file must open with a `---` line");
  }
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === DELIMITER);
  if (end === -1) {
    throw new FrontmatterError("unterminated frontmatter: no closing `---` line");
  }
  return { block: lines.slice(1, end).join("\n"), body: lines.slice(end + 1).join("\n") };
}

function unquote(value: string): string {
  const quoted = /^"(.*)"$/.exec(value) ?? /^'(.*)'$/.exec(value);
  return quoted?.[1] ?? value;
}

function readEntries(block: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const raw of block.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const match = /^([A-Za-z][A-Za-z0-9]*)\s*:\s*(.*)$/.exec(line);
    if (match === null) {
      throw new FrontmatterError(`not a \`key: value\` line: ${JSON.stringify(raw)}`);
    }
    const [, key, value] = match as unknown as [string, string, string];
    if (entries.has(key)) throw new FrontmatterError(`duplicate key \`${key}\``);
    entries.set(key, value.trim());
  }
  return entries;
}

function requireString(entries: Map<string, string>, key: string): string {
  const raw = entries.get(key);
  if (raw === undefined) throw new FrontmatterError(`missing required key \`${key}\``);
  const value = unquote(raw).trim();
  if (value === "") throw new FrontmatterError(`\`${key}\` is empty`);
  return value;
}

function requireBoolean(entries: Map<string, string>, key: string): boolean {
  const raw = entries.get(key);
  if (raw === undefined) throw new FrontmatterError(`missing required key \`${key}\``);
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new FrontmatterError(`\`${key}\` must be true or false, got ${JSON.stringify(raw)}`);
}

function requireInteger(entries: Map<string, string>, key: string): number {
  const raw = entries.get(key);
  if (raw === undefined) throw new FrontmatterError(`missing required key \`${key}\``);
  if (!/^-?\d+$/.test(raw)) {
    throw new FrontmatterError(`\`${key}\` must be a whole number, got ${JSON.stringify(raw)}`);
  }
  return Number(raw);
}

function readComponents(entries: Map<string, string>): readonly InfoPageComponent[] | undefined {
  const raw = entries.get("components");
  if (raw === undefined) return undefined;
  const inner = /^\[(.*)]$/.exec(raw)?.[1];
  if (inner === undefined) {
    throw new FrontmatterError(
      "`components` must be an inline list, e.g. `components: [LegalSets]`",
    );
  }
  const names: InfoPageComponent[] = [];
  for (const raw of inner.split(",")) {
    const name = unquote(raw.trim());
    if (name === "") continue;
    if (!isInfoPageComponent(name)) {
      // MDX executes, so an unrecognised name is refused here rather than
      // reaching the renderer (§25).
      throw new FrontmatterError(
        `\`${name}\` is not an allowed component. Allowed: ${INFO_PAGE_COMPONENTS.join(", ")}`,
      );
    }
    names.push(name);
  }
  return names;
}

const KNOWN_KEYS = new Set([
  "title",
  "navLabel",
  "navOrder",
  "description",
  "published",
  "components",
]);

export function parseFrontmatter(source: string): ParsedPage {
  const { block, body } = splitFrontmatter(source);
  const entries = readEntries(block);

  for (const key of entries.keys()) {
    if (!KNOWN_KEYS.has(key)) {
      throw new FrontmatterError(`unknown key \`${key}\`. Allowed: ${[...KNOWN_KEYS].join(", ")}`);
    }
  }

  const components = readComponents(entries);
  const frontmatter: InfoPageFrontmatter = {
    title: requireString(entries, "title"),
    navLabel: requireString(entries, "navLabel"),
    navOrder: requireInteger(entries, "navOrder"),
    description: requireString(entries, "description"),
    published: requireBoolean(entries, "published"),
    // `exactOptionalPropertyTypes` — an absent list is an absent key, not `undefined`.
    ...(components === undefined ? {} : { components }),
  };

  return { frontmatter, body };
}
