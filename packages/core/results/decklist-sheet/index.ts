import { normalizeHandle } from "../../identity/normalize-handle/index";

/**
 * An admin's sheet of decklists for one event (E20.37) — a row per player, a
 * name and a deck — read into one deck per entry of that event.
 *
 * The deck cell is a deck already on the site (its id, or a link to it) or the
 * list written out, one card per line or `;` between cards. A link to anywhere
 * else is refused rather than fetched.
 */

export type SheetDeck =
  | { readonly kind: "saved"; readonly deckId: string }
  | { readonly kind: "text"; readonly text: string };

export interface SheetEntry<P> {
  readonly playerId: P;
  readonly displayName: string | null;
  readonly handles: readonly string[];
}

export interface DecklistSheet<P> {
  readonly decks: readonly { readonly playerId: P; readonly deck: SheetDeck }[];
  /** One per row that was not used, numbered as a spreadsheet numbers them. */
  readonly issues: readonly { readonly row: number; readonly message: string }[];
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function readDecklistSheet<P>(
  rows: readonly (readonly string[])[],
  entries: readonly SheetEntry<P>[],
): DecklistSheet<P> {
  const header = rows[0]?.map((cell) => cell.trim().toLowerCase()) ?? [];
  const hasHeader = header.includes("player") && header.includes("deck");
  const playerColumn = hasHeader ? header.indexOf("player") : 0;
  const deckColumn = hasHeader ? header.indexOf("deck") : 1;

  const byName = new Map<string, SheetEntry<P>[]>();
  for (const entry of entries) {
    const names = new Set(
      [entry.displayName ?? "", ...entry.handles].map(normalizeHandle).filter(Boolean),
    );
    for (const name of names) byName.set(name, [...(byName.get(name) ?? []), entry]);
  }

  const decks: DecklistSheet<P>["decks"][number][] = [];
  const issues: DecklistSheet<P>["issues"][number][] = [];
  const seen = new Set<P>();

  rows.forEach((cells, index) => {
    if (hasHeader && index === 0) return;
    const row = index + 1;
    const player = cells[playerColumn]?.trim() ?? "";
    const cell = cells[deckColumn]?.trim() ?? "";
    if (player === "" && cell === "") return;

    const matches = byName.get(normalizeHandle(player)) ?? [];
    const entry = matches[0];
    const deck = readDeckCell(cell);
    if (entry === undefined) {
      issues.push({ row, message: `No one called “${player}” played in this event.` });
    } else if (matches.length > 1) {
      issues.push({ row, message: `“${player}” could be more than one player in this event.` });
    } else if (seen.has(entry.playerId)) {
      issues.push({ row, message: `${player} already has a deck in an earlier row.` });
    } else if (typeof deck === "string") {
      issues.push({ row, message: deck });
    } else {
      seen.add(entry.playerId);
      decks.push({ playerId: entry.playerId, deck });
    }
  });

  return { decks, issues };
}

/** A deck, or why the cell is not one. */
function readDeckCell(cell: string): SheetDeck | string {
  if (cell === "") return "The deck is empty.";
  const id = UUID.exec(cell)?.[0];
  if (/^https?:\/\//i.test(cell)) {
    return id !== undefined && /\/decks\//.test(cell)
      ? { kind: "saved", deckId: id.toLowerCase() }
      : "Only a link to a deck on this site can be read. Paste the list instead.";
  }
  if (id !== undefined && id.length === cell.length)
    return { kind: "saved", deckId: id.toLowerCase() };
  return {
    kind: "text",
    text: cell
      .split(/\r?\n|;/)
      .map((line) => line.trim())
      .join("\n"),
  };
}
