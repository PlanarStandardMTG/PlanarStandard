/**
 * Whether a tournament feeds Elo when it is first imported. Only Monthlies do.
 *
 * A default, not the decision: it seeds `tournaments.is_rated`, which an admin can
 * flip afterwards (E20.34), so a misnamed event is a click and never a PR.
 *
 * The whole word, because "Mid-Month Madness" is a side event and not a Monthly.
 */
const MONTHLY = /\bmonthly\b/i;

export function ratedByDefault(tournamentName: string): boolean {
  return MONTHLY.test(tournamentName);
}
