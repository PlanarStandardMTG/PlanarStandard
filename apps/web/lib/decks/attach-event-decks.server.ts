import type { DeckCard, DeckId, PlayerId, ProfileId, Tournament } from "@ps/contracts";
import { matchSavedDeck, readDecklist, type SheetDeck } from "@ps/core";
import {
  deleteUnusedEventDecks,
  getDeckWithCards,
  getPlayer,
  insertDeck,
  listDecksWithCards,
  listNamedEntries,
  setEntryDecks,
  type NamedEntry,
} from "@ps/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import { cardIndex } from "@/lib/cards/card-index";
import { toDeckCards } from "@/lib/decks/deck-cards";

/**
 * An event's decklists onto its standings (E18.23) — the decklist line's work,
 * whether the lists came from melee.gg or an admin's sheet (E20.37).
 *
 * Each list lands on its player's entry as, in order: the deck the entry
 * already has, if it is the same list, so a re-run writes nothing; the
 * member's own saved deck with exactly these cards, when the player is linked
 * to a member (E20.39); or a new deck, locked at the event (ADR 013). A deck an
 * entry stops naming is deleted if the event made it and nothing else uses it.
 */

export interface EventDeck {
  readonly playerId: PlayerId;
  readonly deck: SheetDeck;
  readonly name?: string;
  readonly archetypeRaw?: string;
}

export interface AttachReport {
  readonly attached: number;
  readonly unchanged: number;
  readonly problems: readonly string[];
}

export async function attachEventDecks(
  service: SupabaseClient,
  tournament: Tournament,
  decks: readonly EventDeck[],
  via: "registration" | "organizer",
): Promise<AttachReport> {
  const entries = new Map(
    (await listNamedEntries(service, [tournament.id])).map((entry) => [entry.playerId, entry]),
  );
  const current = new Map(
    (
      await listDecksWithCards(service, {
        ids: [...entries.values()].flatMap((entry) =>
          entry.deckId === null ? [] : [entry.deckId],
        ),
      })
    ).map((deck) => [deck.id, deck]),
  );
  const saved = new Map<ProfileId, Awaited<ReturnType<typeof listDecksWithCards>>>();
  const savedBy = async (profileId: ProfileId) => {
    // A private deck stays private: an entry naming it would show everyone a dead link.
    if (!saved.has(profileId)) {
      const own = await listDecksWithCards(service, { savedBy: profileId });
      saved.set(
        profileId,
        own.filter((deck) => deck.visibility !== "private"),
      );
    }
    return saved.get(profileId) ?? [];
  };

  const links: { playerId: PlayerId; deckId: DeckId }[] = [];
  const replaced: DeckId[] = [];
  const problems: string[] = [];
  let unchanged = 0;

  for (const item of decks) {
    const entry = entries.get(item.playerId);
    const who = entry?.displayName ?? "A player";
    if (entry === undefined) {
      problems.push(`${who} has no standing in ${tournament.name}.`);
      continue;
    }

    let deckId: DeckId;
    if (item.deck.kind === "saved") {
      const deck = await getDeckWithCards(service, item.deck.deckId as DeckId);
      if (deck === null) {
        problems.push(`${who}: no deck on the site has the id ${item.deck.deckId}.`);
        continue;
      }
      deckId = deck.id;
    } else {
      const cards = toDeckCards(readDecklist(item.deck.text, cardIndex()).deck);
      if (cards.length === 0) {
        problems.push(`${who}: the list has no cards that could be read.`);
        continue;
      }
      const existing = entry.deckId === null ? undefined : current.get(entry.deckId);
      if (existing !== undefined && matchSavedDeck(cards, [existing]).exact !== null) {
        unchanged += 1;
        continue;
      }
      const profileId = (await getPlayer(service, entry.playerId))?.profileId ?? null;
      const own = profileId === null ? null : matchSavedDeck(cards, await savedBy(profileId)).exact;
      deckId =
        own?.id ??
        (await newEventDeck(
          service,
          tournament,
          entry,
          item,
          item.deck.text,
          cards,
          profileId,
          via,
        ));
    }

    if (deckId === entry.deckId) {
      unchanged += 1;
      continue;
    }
    if (entry.deckId !== null) replaced.push(entry.deckId);
    links.push({ playerId: entry.playerId, deckId });
  }

  await setEntryDecks(service, tournament.id, links);
  await deleteUnusedEventDecks(service, replaced);
  return { attached: links.length, unchanged, problems };
}

/** Take an event's lists off its standings, and delete the decks only it used. */
export async function detachEventDecks(
  service: SupabaseClient,
  tournament: Tournament,
): Promise<number> {
  const decked = (await listNamedEntries(service, [tournament.id])).filter(
    (entry): entry is NamedEntry & { deckId: DeckId } => entry.deckId !== null,
  );
  await setEntryDecks(
    service,
    tournament.id,
    decked.map((entry) => ({ playerId: entry.playerId, deckId: null })),
  );
  await deleteUnusedEventDecks(service, [...new Set(decked.map((entry) => entry.deckId))]);
  return decked.length;
}

async function newEventDeck(
  service: SupabaseClient,
  tournament: Tournament,
  entry: NamedEntry,
  item: EventDeck,
  text: string,
  cards: readonly DeckCard[],
  ownerId: ProfileId | null,
  via: "registration" | "organizer",
): Promise<DeckId> {
  const deck = await insertDeck(
    service,
    {
      name:
        item.name ?? item.archetypeRaw ?? `${entry.displayName ?? "Unknown"} at ${tournament.name}`,
      ownerId,
      playerId: entry.playerId,
      seasonId: tournament.seasonId,
      format: "planar_standard",
      formatVersionId: tournament.formatVersionId,
      archetypeId: null,
      archetypeRaw: item.archetypeRaw ?? null,
      visibility: "public",
      descriptionMarkdown: null,
      sourceUrl: null,
      rawImport: text,
      submittedVia: via,
      lockedAt: `${tournament.eventDate}T00:00:00.000Z`,
      parentDeckId: null,
      isLegal: null,
      validation: null,
      hiddenAt: null,
    },
    cards,
  );
  return deck.id;
}
