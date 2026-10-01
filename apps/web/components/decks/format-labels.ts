import type { Deck, DeckFormat, FormatVersion } from "@ps/contracts";

export const FORMAT_LABELS: Record<DeckFormat, string> = {
  planar_standard: "Planar Standard",
  kitchen_table: "Kitchen Table",
};

/** One entry in the editor's format menu: a format version's id, or Kitchen Table. */
export interface FormatOption {
  readonly value: string;
  readonly label: string;
  readonly current: boolean;
}

/** Every version an admin has made, current first, then Kitchen Table (E20.54). */
export function formatOptions(versions: readonly FormatVersion[]): FormatOption[] {
  return [
    ...versions.map((version) => ({
      value: version.id,
      label: version.name,
      current: version.isCurrent,
    })),
    { value: "kitchen_table", label: FORMAT_LABELS.kitchen_table, current: false },
  ];
}

type DeckFormatFields = Pick<Deck, "format" | "formatVersionId">;

/** The editor's starting choice: the deck's own version, else the current one. */
export function formatChoice(
  deck: DeckFormatFields | null,
  versions: readonly FormatVersion[],
): string {
  if (deck?.format === "kitchen_table") return "kitchen_table";
  const own = versions.find((version) => version.id === deck?.formatVersionId);
  const current = versions.find((version) => version.isCurrent);
  return (own ?? current ?? versions[0])?.id ?? "kitchen_table";
}

/** A deck's format as a list shows it: its version's name when it has one. */
export function deckFormatLabel(deck: DeckFormatFields, versions: readonly FormatVersion[]) {
  if (deck.format === "kitchen_table") return FORMAT_LABELS.kitchen_table;
  return (
    versions.find((version) => version.id === deck.formatVersionId)?.name ??
    FORMAT_LABELS.planar_standard
  );
}
