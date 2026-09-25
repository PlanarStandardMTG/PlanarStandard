import type {
  Deck,
  DeckCard,
  DeckId,
  DeckWithCards,
  PlayerId,
  ProfileId,
  SeasonId,
} from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DECK_COLUMNS,
  DECK_SUMMARY_COLUMNS,
  DECK_WITH_CARDS_COLUMNS,
  toDeck,
  toDeckWithCards,
  type DeckRow,
  type DeckWithCardsRow,
} from "./rows";

/**
 * Reads and writes over `decks` and `deck_cards` (E13.16).
 *
 * The reads go through the public client and are covered by the read policies,
 * which admit anything not `private` — unlisted means "not in the listings", so
 * **the listings are what leave it out**, here, rather than the policy. Getting
 * that backwards either breaks every share link or leaks every unlisted deck,
 * and the two functions below are where the distinction lives.
 */

/** One deck with its list — the deck page, and the only read that needs the cards. */
export async function getDeckWithCards(
  client: SupabaseClient,
  deckId: DeckId,
): Promise<DeckWithCards | null> {
  const { data, error } = await client
    .from("decks")
    .select(DECK_WITH_CARDS_COLUMNS)
    .eq("id", deckId)
    .maybeSingle();

  if (error !== null) throw new Error(`getDeckWithCards failed: ${error.message}`);
  return data === null ? null : toDeckWithCards(data as unknown as DeckWithCardsRow);
}

/**
 * Every deck a player registered, newest first.
 *
 * Unlisted decks included: this is the player's own page, and a deck they chose
 * not to publish to the browse pages is still theirs. `listPublicDecksBySeason`
 * is the one that has to leave them out.
 */
export async function listDecksByPlayer(
  client: SupabaseClient,
  playerId: PlayerId,
): Promise<readonly Deck[]> {
  const { data, error } = await client
    .from("decks")
    .select(DECK_SUMMARY_COLUMNS)
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });

  if (error !== null) throw new Error(`listDecksByPlayer failed: ${error.message}`);
  return (data as unknown as DeckRow[]).map(toDeck);
}

/**
 * Public decks from one season — the browse page and every metagame count.
 *
 * `visibility = 'public'` explicitly, not left to the policy. The policy decides
 * what may be read; a listing decides what is listed, and an unlisted deck
 * passes the first and fails the second by design.
 */
export async function listPublicDecksBySeason(
  client: SupabaseClient,
  seasonId: SeasonId,
  limit: number,
): Promise<readonly Deck[]> {
  const { data, error } = await client
    .from("decks")
    .select(DECK_SUMMARY_COLUMNS)
    .eq("season_id", seasonId)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error !== null) throw new Error(`listPublicDecksBySeason failed: ${error.message}`);
  return (data as unknown as DeckRow[]).map(toDeck);
}

/** What `insertDeck` needs that the database will not supply. */
export type NewDeck = Omit<Deck, "id" | "createdAt">;

/**
 * Write a deck and its list, and return what was stored.
 *
 * **Not atomic, and it cannot be from here.** PostgREST has no transaction
 * spanning two tables, so this inserts the deck, then the cards, and deletes the
 * deck if the cards fail. That compensation is the point: a `decks` row with no
 * `deck_cards` is a deck that reads as empty everywhere and is indistinguishable
 * from a legitimately empty one, which is worse than no row at all. If this ever
 * needs to be genuinely atomic — concurrent writers to the same deck, say — the
 * answer is a `plpgsql` function and an RPC, not a cleverer sequence here.
 *
 * Takes the service-role client. There is no insert policy on either table;
 * role-gated writes are E14.2.
 */
export async function insertDeck(
  serviceClient: SupabaseClient,
  deck: NewDeck,
  cards: readonly DeckCard[],
): Promise<DeckWithCards> {
  const { data, error } = await serviceClient
    .from("decks")
    .insert({
      name: deck.name,
      owner_id: deck.ownerId,
      player_id: deck.playerId,
      season_id: deck.seasonId,
      format_version_id: deck.formatVersionId,
      archetype_id: deck.archetypeId,
      archetype_raw: deck.archetypeRaw,
      visibility: deck.visibility,
      description_markdown: deck.descriptionMarkdown,
      source_url: deck.sourceUrl,
      raw_import: deck.rawImport,
      submitted_via: deck.submittedVia,
      locked_at: deck.lockedAt,
      parent_deck_id: deck.parentDeckId,
      is_legal: deck.isLegal,
      validation: deck.validation,
    })
    .select("id")
    .single();

  if (error !== null) throw new Error(`insertDeck failed: ${error.message}`);
  const deckId = (data as unknown as { id: string }).id as DeckId;

  if (cards.length > 0) {
    const { error: cardsError } = await serviceClient.from("deck_cards").insert(
      cards.map((card) => ({
        deck_id: deckId,
        oracle_id: card.oracleId,
        card_name: card.name,
        quantity: card.quantity,
        board: card.board,
        set_code: card.set,
        collector_number: card.collector,
      })),
    );

    if (cardsError !== null) {
      await serviceClient.from("decks").delete().eq("id", deckId);
      throw new Error(`insertDeck failed writing cards: ${cardsError.message}`);
    }
  }

  const stored = await getDeckWithCards(serviceClient, deckId);
  if (stored === null) throw new Error("insertDeck wrote a deck it could not read back");
  return stored;
}

/**
 * Every deck one person owns, at any visibility (E16.11).
 *
 * Like `listPostsByAuthor`, this exists for the data export and is not a feed:
 * a private deck is still the owner's data and still has to be handed over when
 * they ask for it.
 */
export async function listDecksByOwner(
  client: SupabaseClient,
  ownerId: ProfileId,
): Promise<readonly Deck[]> {
  const { data, error } = await client
    .from("decks")
    .select(DECK_COLUMNS)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error !== null) throw new Error(`listDecksByOwner failed: ${error.message}`);
  return (data as unknown as DeckRow[]).map(toDeck);
}

/** What a member supplies when importing a deck; the database fills in the rest. */
export interface MemberDeck {
  readonly name: string;
  readonly visibility: Deck["visibility"];
  readonly rawImport: string;
  readonly formatVersionId: Deck["formatVersionId"];
}

/**
 * A member's own import, written as the member (E20.28).
 *
 * Takes the signed-in client, so `decks_member_insert` decides: the owner is
 * the caller and a member cannot set a player, a lock or a verdict. One RPC,
 * so the deck and its list are written in one transaction.
 */
export async function createMemberDeck(
  client: SupabaseClient,
  deck: MemberDeck,
  cards: readonly DeckCard[],
): Promise<DeckId> {
  const { data, error } = await client.rpc("create_deck", {
    deck_name: deck.name,
    deck_visibility: deck.visibility,
    raw_import: deck.rawImport,
    format_version_id: deck.formatVersionId,
    cards: cards.map((card) => ({
      oracle_id: card.oracleId,
      card_name: card.name,
      quantity: card.quantity,
      board: card.board,
      set_code: card.set,
      collector_number: card.collector,
    })),
  });

  if (error !== null) throw new Error(`createMemberDeck failed: ${error.message}`);
  return data as DeckId;
}

/** Delete one of the caller's own unlocked decks. False when there was none to delete. */
export async function deleteMemberDeck(client: SupabaseClient, deckId: DeckId): Promise<boolean> {
  const { data, error } = await client.from("decks").delete().eq("id", deckId).select("id");

  if (error !== null) throw new Error(`deleteMemberDeck failed: ${error.message}`);
  return (data ?? []).length > 0;
}
