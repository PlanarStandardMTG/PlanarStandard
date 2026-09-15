import type {
  IsoDate,
  LedgerMatch,
  PlayerId,
  PlayerRating,
  RatingAnomaly,
  RatingConfig,
  RatingEvent,
  ReplayResult,
} from "@ps/contracts";

import { applyMatch, type PlayerSnapshot } from "../apply-match/index";

export interface ReplayOptions {
  /**
   * Reference date for `isActive`. Defaults to the latest event date in the
   * stream — core is pure, so it cannot ask what today is.
   */
  readonly asOf?: IsoDate;
}

interface PlayerState {
  rating: number;
  peakRating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  tournaments: Set<string>;
  lastPlayed: IsoDate | null;
}

/**
 * Replays an entire match ledger into a rating table.
 *
 * Full recompute, never incremental (ADR 004): every rating on the site is a
 * function of the match stream and this config, and nothing else. The matches
 * arrive already resolved to player ids — resolution happens at read time, which
 * is what lets two handles merge into one rating without a single row in
 * `matches` changing (ADR 003).
 *
 * Does no I/O and never throws. Bad data comes back as anomalies.
 */
export function replay(
  matches: readonly LedgerMatch[],
  config: RatingConfig,
  options: ReplayOptions = {},
): ReplayResult {
  const ordered = [...matches].sort(byDateThenRoundThenId);
  const states = new Map<PlayerId, PlayerState>();
  const events: RatingEvent[] = [];
  const anomalies: RatingAnomaly[] = [];
  const seenMatchIds = new Map<string, number>();
  let matchesApplied = 0;

  const stateOf = (playerId: PlayerId): PlayerState => {
    const existing = states.get(playerId);
    if (existing !== undefined) return existing;
    const fresh: PlayerState = {
      rating: config.initialRating,
      peakRating: config.initialRating,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      tournaments: new Set(),
      lastPlayed: null,
    };
    states.set(playerId, fresh);
    return fresh;
  };

  ordered.forEach((match, streamIndex) => {
    const duplicateOf = seenMatchIds.get(match.matchId);
    if (duplicateOf !== undefined) {
      anomalies.push({
        kind: "duplicate-match-id",
        matchId: match.matchId,
        tournamentId: match.tournamentId,
        detail: `match id first seen at stream index ${duplicateOf}; the repeat was skipped`,
        streamIndex,
      });
      return;
    }
    seenMatchIds.set(match.matchId, streamIndex);

    if (match.p2PlayerId !== null && match.p1PlayerId === match.p2PlayerId) {
      anomalies.push({
        kind: "self-play",
        matchId: match.matchId,
        tournamentId: match.tournamentId,
        detail: "both sides resolved to the same player; the match was skipped",
        playerId: match.p1PlayerId,
      });
      return;
    }

    // Recorded, not skipped: Elo reads the result, and a mis-keyed game count is
    // no reason to discard a real one. The anomaly is what gets it corrected.
    const gameCountProblem = impossibleGameCount(match);
    if (gameCountProblem !== null) {
      anomalies.push({
        kind: "impossible-game-count",
        matchId: match.matchId,
        tournamentId: match.tournamentId,
        detail: gameCountProblem,
        p1Games: match.p1Games,
        p2Games: match.p2Games,
        gameDraws: match.gameDraws,
        result: match.result,
      });
    }

    const p1 = stateOf(match.p1PlayerId);
    const p2 = match.p2PlayerId === null ? null : stateOf(match.p2PlayerId);

    const outcome = applyMatch(
      {
        result: match.result,
        isElimination: match.isElimination,
        tournamentWeight: match.tournamentWeight,
      },
      snapshot(match.p1PlayerId, p1),
      p2 === null ? null : snapshot(match.p2PlayerId as PlayerId, p2),
      config,
    );

    if (!outcome.applied) {
      // A counted bye still marks the player present, but cannot move a rating:
      // there is no opponent to be right or wrong about.
      if (outcome.reason === "bye" && config.countByes) {
        recordAppearance(p1, match);
        p1.wins += 1;
        p1.matchesPlayed += 1;
      }
      return;
    }

    matchesApplied += 1;
    const { p1: p1Update, p2: p2Update } = outcome.update;

    for (const [state, update] of [
      [p1, p1Update],
      [p2 as PlayerState, p2Update],
    ] as const) {
      state.rating = update.ratingAfter;
      state.peakRating = Math.max(state.peakRating, update.ratingAfter);
      state.matchesPlayed += 1;
      if (update.actualScore === 1) state.wins += 1;
      else if (update.actualScore === 0.5) state.draws += 1;
      else state.losses += 1;
      recordAppearance(state, match);

      events.push({
        playerId: update.playerId,
        matchId: match.matchId,
        tournamentId: match.tournamentId,
        opponentId: update.opponentId,
        eventDate: match.eventDate,
        ratingBefore: update.ratingBefore,
        ratingAfter: update.ratingAfter,
        expectedScore: update.expectedScore,
        actualScore: update.actualScore,
        kFactor: update.kFactor,
        matchNumber: state.matchesPlayed,
      });

      // |delta| is K * |actual - expected| and both are bounded, so exceeding K
      // means the arithmetic is wrong rather than the data.
      const delta = Math.abs(update.ratingAfter - update.ratingBefore);
      if (delta > update.kFactor + 1e-9) {
        anomalies.push({
          kind: "rating-jump",
          matchId: match.matchId,
          tournamentId: match.tournamentId,
          detail: `rating moved ${delta.toFixed(4)} in one match, beyond the K factor in force`,
          playerId: update.playerId,
          ratingBefore: update.ratingBefore,
          ratingAfter: update.ratingAfter,
          bound: update.kFactor,
        });
      }
    }
  });

  const asOf = options.asOf ?? latestEventDate(ordered);
  const ratings = [...states]
    .map(([playerId, state]) => toPlayerRating(playerId, state, config, asOf))
    .sort((a, b) => b.rating - a.rating || a.playerId.localeCompare(b.playerId));

  return { ratings, events, anomalies, matchesApplied };
}

function snapshot(playerId: PlayerId, state: PlayerState): PlayerSnapshot {
  return { playerId, rating: state.rating, matchesPlayed: state.matchesPlayed };
}

function recordAppearance(state: PlayerState, match: LedgerMatch): void {
  state.tournaments.add(match.tournamentId);
  if (state.lastPlayed === null || match.eventDate > state.lastPlayed) {
    state.lastPlayed = match.eventDate;
  }
}

function toPlayerRating(
  playerId: PlayerId,
  state: PlayerState,
  config: RatingConfig,
  asOf: IsoDate | null,
): PlayerRating {
  const idle =
    state.lastPlayed === null || asOf === null ? null : daysBetween(state.lastPlayed, asOf);
  return {
    playerId,
    rating: state.rating,
    peakRating: state.peakRating,
    matchesPlayed: state.matchesPlayed,
    wins: state.wins,
    losses: state.losses,
    draws: state.draws,
    tournamentsPlayed: state.tournaments.size,
    lastPlayed: state.lastPlayed,
    isProvisional: state.matchesPlayed < config.provisionalMatches,
    isActive: idle === null ? true : idle <= config.inactiveAfterDays,
  };
}

/**
 * Total order over the stream. Date, then round, then match id — the last is
 * unique, so two runs over the same matches in any input order replay identically.
 */
function byDateThenRoundThenId(a: LedgerMatch, b: LedgerMatch): number {
  if (a.eventDate !== b.eventDate) return a.eventDate < b.eventDate ? -1 : 1;
  if (a.round !== b.round) return a.round - b.round;
  return a.matchId < b.matchId ? -1 : a.matchId > b.matchId ? 1 : 0;
}

function latestEventDate(ordered: readonly LedgerMatch[]): IsoDate | null {
  const last = ordered[ordered.length - 1];
  return last === undefined ? null : last.eventDate;
}

const MS_PER_DAY = 86_400_000;

/** Whole days from `from` to `to`. UTC arithmetic on a `YYYY-MM-DD`: no timezone, no clock. */
function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMillis(to) - toUtcMillis(from)) / MS_PER_DAY);
}

function toUtcMillis(date: IsoDate): number {
  const parts = date.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return Date.UTC(year, month - 1, day);
}

/**
 * Game counts that contradict the recorded result. All-zero counts mean the
 * source did not report games, which is common and not an anomaly.
 */
function impossibleGameCount(match: LedgerMatch): string | null {
  const { p1Games, p2Games, gameDraws, result } = match;
  if (p1Games < 0 || p2Games < 0 || gameDraws < 0) {
    return `negative game count: ${p1Games}-${p2Games}-${gameDraws}`;
  }
  if (p1Games === 0 && p2Games === 0 && gameDraws === 0) return null;

  if (result === "p1_win" && p1Games <= p2Games) {
    return `recorded as p1_win but games are ${p1Games}-${p2Games}`;
  }
  if (result === "p2_win" && p2Games <= p1Games) {
    return `recorded as p2_win but games are ${p1Games}-${p2Games}`;
  }
  if (result === "draw" && p1Games !== p2Games) {
    return `recorded as a draw but games are ${p1Games}-${p2Games}`;
  }
  return null;
}
