import type { RatingConfig } from "@ps/contracts";

/** What `pick-k` needs to know about a player: how settled they are, and how strong. */
export interface KFactorInput {
  /** Rated matches already applied to this player. */
  readonly matchesPlayed: number;
  /** Rating going into the match. */
  readonly rating: number;
}

export type KTier = "provisional" | "elite" | "standard";

/**
 * Which tier a player is in. Provisional is checked first: a new account that
 * happens to be rated above the elite threshold has not earned the slow K yet,
 * it has simply not played enough matches to be anywhere.
 */
export function kTier(player: KFactorInput, config: RatingConfig): KTier {
  if (player.matchesPlayed < config.provisionalMatches) return "provisional";
  if (player.rating >= config.eliteThreshold) return "elite";
  return "standard";
}

/**
 * The K factor for one player in one match: their tier's K, times the
 * tournament's weight.
 *
 * Every threshold comes from `RatingConfig`, which is an admin-edited row — none
 * of these numbers is hard-coded here, so retuning the ladder never needs a deploy.
 */
export function pickK(
  player: KFactorInput,
  config: RatingConfig,
  tournamentWeight: number,
): number {
  const base = {
    provisional: config.kProvisional,
    elite: config.kElite,
    standard: config.kStandard,
  }[kTier(player, config)];
  return base * tournamentWeight;
}
