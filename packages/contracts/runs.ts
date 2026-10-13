// An event run on the site itself (§28): its structure, entrants, rounds and pairings, as
// `core/runs` reads them. The schema (E26.11, E26.12) maps onto these; contact names and
// audit fields stay out, because nothing in `core` needs them.

import type {
  FormatVersionId,
  IsoDateTime,
  ProfileId,
  RunEntrantId,
  RunId,
  RunPairingId,
  RunRoundId,
  TournamentId,
} from "./primitives";

/**
 * Where a run is in its life. `cancelled` is reachable from every state but
 * `finished`; which move is allowed, and what it needs, is `core/runs/run-state`'s call.
 */
export type RunState = "draft" | "registration" | "running" | "top_cut" | "finished" | "cancelled";

/**
 * The organizer's choice of shape, prefilled by `core/runs/suggest-rounds` and free to
 * change (§28). `swissRounds: 0` is straight single elimination; `topCut: 0` is no cut.
 * A cut need not be a power of two — the top seeds get byes.
 */
export interface RunStructure {
  readonly swissRounds: number;
  readonly topCut: number;
}

export interface Run extends RunStructure {
  readonly id: RunId;
  readonly name: string;
  /** Null until the organizer sets a date. */
  readonly startsAt: IsoDateTime | null;
  readonly description: string | null;
  /** The versions decks are checked against, in the organizer's order; the first is the default. */
  readonly formatVersionIds: readonly FormatVersionId[];
  /**
   * The tournament the run became when it finished and was imported (ADR 015). Null
   * while it is live: a run is not on `/tournaments` until then.
   */
  readonly tournamentId: TournamentId | null;
  readonly organizerId: ProfileId;
  readonly state: RunState;
  /**
   * Every random choice — round 1, an exact tie — derives from this, so re-pairing a
   * round reproduces it. Chosen once, when the run is created.
   */
  readonly seed: string;
}

export interface RunEntrant {
  readonly id: RunEntrantId;
  readonly runId: RunId;
  /** Null for a guest the organizer typed in. */
  readonly profileId: ProfileId | null;
  readonly displayName: string;
  /**
   * The profile handle the member registered under, which their matches carry into the
   * ledger. Null for a guest, who goes in as `run-guest-<id>` instead (§28).
   */
  readonly handle: string | null;
  readonly checkedIn: boolean;
  /**
   * How many rounds had been paired when the drop came in: the entrant is not paired
   * after that (MTR §2.10). `0` dropped before round 1; null has not dropped.
   */
  readonly droppedAfterRound: number | null;
}

export type RunRoundKind = "swiss" | "elimination";

/** One round. `number` counts through the whole run, so the first cut round follows the last Swiss one. */
export interface RunRound {
  readonly id: RunRoundId;
  readonly runId: RunId;
  readonly number: number;
  readonly kind: RunRoundKind;
  readonly pairedAt: IsoDateTime;
}

/**
 * Games as the players report them, `wins–losses–draws` from player 1's side. An
 * intentional draw with no games played is `0–0–3` (MTR §2.5); an unfinished game is
 * a draw; an unplayed one is not counted at all.
 */
export interface RunGames {
  readonly p1Wins: number;
  readonly p2Wins: number;
  readonly draws: number;
}

/**
 * `reported` is one player's word; only `confirmed` — by the opponent, or by the
 * organizer entering or accepting it — counts toward standings (E26.20).
 */
export type RunResultStatus = "pending" | "reported" | "confirmed";

export interface RunPairing {
  readonly id: RunPairingId;
  readonly roundId: RunRoundId;
  /** The round's `number`, carried so `core` needs no join. */
  readonly round: number;
  readonly table: number;
  readonly p1EntrantId: RunEntrantId;
  /** Null is a bye: a 2–0 win, confirmed from the moment it is paired (MTR Appendix C). */
  readonly p2EntrantId: RunEntrantId | null;
  /** Null until someone reports, and always null on a bye. */
  readonly games: RunGames | null;
  readonly status: RunResultStatus;
}

/**
 * A pairing `core` proposes for the next round, before it is posted and given an id. The
 * higher-ranked player is `p1`; a bye is `p2EntrantId: null` on the last table.
 */
export interface ProposedRunPairing {
  readonly table: number;
  readonly p1EntrantId: RunEntrantId;
  readonly p2EntrantId: RunEntrantId | null;
}

/** A pairing as the run's pages show it: who reported the result, so the other player can confirm it. */
export interface PostedRunPairing extends RunPairing {
  readonly reportedBy: ProfileId | null;
  readonly confirmedBy: ProfileId | null;
}

/** A result's state at one moment, as `RunResultChange` records it either side of a change. */
export interface RunResultSnapshot {
  readonly games: RunGames | null;
  readonly status: RunResultStatus;
}

/** One change to a pairing's result, written by the database on every change (E26.12). */
export interface RunResultChange {
  readonly pairingId: RunPairingId;
  /** Null only for a change the server made as itself. */
  readonly changedBy: ProfileId | null;
  readonly before: RunResultSnapshot;
  readonly after: RunResultSnapshot;
  readonly createdAt: IsoDateTime;
}

/** An entrant's counted results: confirmed pairings and byes, nothing pending. */
export interface RunRecord {
  readonly entrantId: RunEntrantId;
  readonly matchPoints: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly byes: number;
  /** Rounds with a counted result, byes included: match-win %'s denominator is 3 × this. */
  readonly roundsPlayed: number;
  readonly gamePoints: number;
  /** Games actually played, byes' two games included: game-win %'s denominator is 3 × this. */
  readonly gamesPlayed: number;
}

/**
 * One line of the standings, derived on every read and never stored (ADR 004).
 * Percentages are fractions at full precision, each floored at 0.33; display rounds
 * them to two decimals (§28).
 */
export interface RunStanding extends RunRecord {
  /** 1-based. Exact ties are broken by the run's seed, so no two lines share one. */
  readonly rank: number;
  readonly opponentMatchWinPct: number;
  readonly gameWinPct: number;
  readonly opponentGameWinPct: number;
  readonly dropped: boolean;
}
