import type { Color, DeckId, MatchResult, PlayerId, Tournament, WinLossDraw } from "@ps/contracts";
import { colorIdentity, eventRounds, type EventRound } from "@ps/core";
import {
  getTournamentBySlug,
  listDecksWithCards,
  listNamedEntries,
  listNamedMatchesByTournament,
  type MatchSide,
} from "@ps/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import { cardIndex } from "@/lib/cards/card-index";
import { toResolvedDeck } from "@/lib/decks/deck-view";

export interface EntryDeck {
  readonly id: DeckId;
  readonly name: string | null;
  readonly archetype: string | null;
  readonly colors: readonly Color[];
}

export interface Standing {
  readonly playerId: PlayerId;
  readonly placement: number | null;
  readonly name: string;
  readonly record: WinLossDraw;
  readonly dropped: boolean;
  readonly deck: EntryDeck | null;
}

export interface PairingSide {
  /** Null when the player is hidden. */
  readonly playerId: PlayerId | null;
  readonly name: string;
  readonly deck: EntryDeck | null;
}

export interface Pairing {
  readonly id: string;
  readonly round: number;
  readonly isElimination: boolean;
  readonly p1: PairingSide;
  /** Null on a bye. */
  readonly p2: PairingSide | null;
  readonly result: MatchResult;
  readonly p1Games: number;
  readonly p2Games: number;
  readonly gameDraws: number;
}

export interface TournamentView {
  readonly tournament: Tournament;
  readonly standings: readonly Standing[];
  readonly rounds: readonly EventRound<Pairing>[];
  readonly decks: number;
}

const HIDDEN = "Hidden player";

/**
 * A past event rebuilt from our own rows (E20.14): its standings from
 * `tournament_entries`, its rounds from the ledger, and the deck each player
 * brought where one is attached. Null when there is no such event, or it is a draft.
 */
export async function loadTournamentView(
  client: SupabaseClient,
  slug: string,
): Promise<TournamentView | null> {
  const tournament = await getTournamentBySlug(client, slug);
  if (tournament === null) return null;

  const [entries, matches] = await Promise.all([
    listNamedEntries(client, [tournament.id]),
    listNamedMatchesByTournament(client, tournament.id),
  ]);
  const decks = await listDecksWithCards(client, {
    ids: entries.flatMap((entry) => (entry.deckId === null ? [] : [entry.deckId])),
  });
  const index = cardIndex();
  const deckById = new Map(
    decks.map((deck): [DeckId, EntryDeck] => [
      deck.id,
      {
        id: deck.id,
        name: deck.name,
        archetype: deck.archetypeRaw,
        colors: colorIdentity(toResolvedDeck(deck), index),
      },
    ]),
  );

  const standings = entries.map((entry): Standing => ({
    playerId: entry.playerId,
    placement: entry.placement,
    name: entry.displayName ?? HIDDEN,
    record: entry.record,
    dropped: entry.dropped,
    deck: entry.deckId === null ? null : (deckById.get(entry.deckId) ?? null),
  }));
  const byPlayer = new Map(standings.map((standing) => [standing.playerId, standing]));
  const side = (named: MatchSide | null): PairingSide => {
    if (named === null) return { playerId: null, name: HIDDEN, deck: null };
    const standing = byPlayer.get(named.playerId);
    return {
      playerId: named.playerId,
      name: standing === undefined || standing.name === HIDDEN ? named.handle : standing.name,
      deck: standing?.deck ?? null,
    };
  };

  const pairings = matches.map((match): Pairing => ({
    id: match.id,
    round: match.round,
    isElimination: match.isElimination,
    p1: side(match.p1),
    p2: match.p2IdentityId === null ? null : side(match.p2),
    result: match.result,
    p1Games: match.p1Games,
    p2Games: match.p2Games,
    gameDraws: match.gameDraws,
  }));

  return {
    tournament,
    standings,
    rounds: eventRounds(pairings),
    decks: standings.filter((standing) => standing.deck !== null).length,
  };
}
