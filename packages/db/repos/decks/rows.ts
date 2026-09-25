import type {
  ArchetypeId,
  Deck,
  DeckCard,
  DeckId,
  DeckSubmissionRoute,
  DeckVisibility,
  DeckWithCards,
  FormatVersionId,
  OracleId,
  PlayerId,
  ProfileId,
  SeasonId,
  SetCode,
} from "@ps/contracts";

/**
 * The `decks` and `deck_cards` rows as PostgREST returns them. Kept next to the
 * mappers: outside this module a deck is a `Deck`, and the snake_case shape of
 * the tables is nobody else's business.
 */
export interface DeckRow {
  readonly id: string;
  readonly name: string;
  readonly owner_id: string | null;
  readonly player_id: string | null;
  readonly season_id: string | null;
  readonly format: string;
  readonly format_version_id: string | null;
  readonly archetype_id: string | null;
  readonly archetype_raw: string | null;
  readonly visibility: DeckVisibility;
  readonly description_markdown: string | null;
  readonly source_url: string | null;
  readonly raw_import: string | null;
  readonly submitted_via: string | null;
  readonly locked_at: string | null;
  readonly parent_deck_id: string | null;
  readonly is_legal: boolean | null;
  readonly validation: unknown;
  readonly hidden_at: string | null;
  readonly created_at: string;
}

export interface DeckCardRow {
  readonly oracle_id: string | null;
  readonly card_name: string;
  readonly quantity: number;
  readonly board: DeckCard["board"];
  readonly set_code: string | null;
  readonly collector_number: string | null;
}

export interface DeckWithCardsRow extends DeckRow {
  readonly cards: readonly DeckCardRow[] | null;
}

export const DECK_COLUMNS =
  "id, name, owner_id, player_id, season_id, format, format_version_id, archetype_id, archetype_raw, " +
  "visibility, description_markdown, source_url, raw_import, submitted_via, locked_at, " +
  "parent_deck_id, is_legal, validation, hidden_at, created_at";

const CARD_COLUMNS = "oracle_id, card_name, quantity, board, set_code, collector_number";

/**
 * `raw_import` is the whole decklist and `validation` is a verdict payload, so
 * neither is selected by a listing. A browse page pulling seventy-five lines of
 * text per row it only shows the name of is the kind of query that is fine at
 * twelve decks and not at twelve hundred.
 */
export const DECK_SUMMARY_COLUMNS =
  "id, name, owner_id, player_id, season_id, format, format_version_id, archetype_id, archetype_raw, " +
  "visibility, description_markdown, source_url, submitted_via, locked_at, parent_deck_id, " +
  "is_legal, hidden_at, created_at";

export const DECK_WITH_CARDS_COLUMNS = `${DECK_COLUMNS}, cards:deck_cards (${CARD_COLUMNS})`;

/** The four values the `submitted_via` check constraint allows, and nothing else. */
const ROUTES: readonly string[] = ["registration", "organizer", "backfill", "import"];

export function toDeck(row: DeckRow): Deck {
  return {
    id: row.id as DeckId,
    name: row.name,
    ownerId: row.owner_id as ProfileId | null,
    playerId: row.player_id as PlayerId | null,
    seasonId: row.season_id as SeasonId | null,
    format: row.format === "kitchen_table" ? "kitchen_table" : "planar_standard",
    formatVersionId: row.format_version_id as FormatVersionId | null,
    archetypeId: row.archetype_id as ArchetypeId | null,
    archetypeRaw: row.archetype_raw,
    visibility: row.visibility,
    descriptionMarkdown: row.description_markdown,
    sourceUrl: row.source_url,
    // Absent from a summary select rather than null in the table, which is why
    // this coalesces instead of asserting.
    rawImport: row.raw_import ?? null,
    submittedVia: toRoute(row.submitted_via),
    lockedAt: row.locked_at,
    parentDeckId: row.parent_deck_id as DeckId | null,
    isLegal: row.is_legal,
    validation: (row.validation ?? null) as Deck["validation"],
    hiddenAt: row.hidden_at,
    createdAt: row.created_at,
  };
}

/**
 * An embedded select carries no order of its own, so the cards are sorted here:
 * maindeck, sideboard, command zone, then by name. Sorting in the mapper rather
 * than in the query because PostgREST orders an embedded resource by a separate
 * parameter that is easy to drop in a refactor and silent when you do — and a
 * decklist whose order depends on what Postgres happened to return is a diff
 * that changes for no reason.
 */
export function toDeckWithCards(row: DeckWithCardsRow): DeckWithCards {
  const cards = (row.cards ?? []).map(toDeckCard);
  cards.sort(
    (a, b) =>
      BOARD_ORDER.indexOf(a.board) - BOARD_ORDER.indexOf(b.board) || a.name.localeCompare(b.name),
  );
  return { ...toDeck(row), cards };
}

const BOARD_ORDER: readonly DeckCard["board"][] = ["main", "side", "command"];

export function toDeckCard(row: DeckCardRow): DeckCard {
  return {
    oracleId: row.oracle_id as OracleId | null,
    name: row.card_name,
    quantity: row.quantity,
    board: row.board,
    set: row.set_code as SetCode | null,
    collector: row.collector_number,
  };
}

/**
 * The column is `text` with a check constraint, so a value outside the four is
 * not supposed to be possible — but a cast would make this module the one place
 * that quietly promises it. Anything unrecognised becomes null, which every
 * caller already handles because the column is nullable.
 */
function toRoute(value: string | null): DeckSubmissionRoute | null {
  return value !== null && ROUTES.includes(value) ? (value as DeckSubmissionRoute) : null;
}
