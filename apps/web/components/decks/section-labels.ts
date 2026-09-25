import type { DeckSectionKey } from "@ps/core";

export const SECTION_LABELS: Record<DeckSectionKey, string> = {
  command: "Command zone",
  creature: "Creatures",
  planeswalker: "Planeswalkers",
  battle: "Battles",
  instant: "Instants",
  sorcery: "Sorceries",
  artifact: "Artifacts",
  enchantment: "Enchantments",
  other: "Other",
  land: "Lands",
  unknown: "Not found in the card pool",
  sideboard: "Sideboard",
};
