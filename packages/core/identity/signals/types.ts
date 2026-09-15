import type { DeckVector, Handle, IdentityId, IsoDate, Signal, TournamentId } from "@ps/contracts";

/** Everything the signals know about one handle, gathered once by the caller. */
export interface HandleObservation {
  readonly identityId: IdentityId;
  readonly handle: Handle;
  /** Trailing parenthetical mined from a decklist filename (E3.6). */
  readonly alias?: string;
  /** One entry per deck this handle registered, maindeck only. */
  readonly deckVectors: readonly DeckVector[];
  /** Every event this handle appeared in, ascending. */
  readonly eventDates: readonly IsoDate[];
  readonly tournamentIds: readonly TournamentId[];
}

export interface SignalContext {
  readonly a: HandleObservation;
  readonly b: HandleObservation;
}

/**
 * Every signal is this shape. Adding one is a new file under `signals/` that
 * exports a `SignalScorer` and a line in `score-candidates`' list — no contract
 * change, and no edit to any other signal.
 */
export type SignalScorer = (context: SignalContext) => Signal | null;
