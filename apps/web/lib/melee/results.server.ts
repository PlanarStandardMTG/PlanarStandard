import { meleeGet, meleeGetAllPages, type MeleeFetch } from "./transport.server";

/**
 * melee.gg tournament results with every personal detail removed (E12.10).
 *
 * Authenticated as tournament staff, melee returns players' legal names,
 * pronouns, Discord and Arena handles and more. None of it is ours to keep, so
 * nothing reads melee's results except through this file, and this file copies
 * out an **allowlist** — a melee id, a result, a decklist — rather than deleting
 * a blocklist. A field melee adds tomorrow is dropped until someone decides it
 * belongs here, instead of leaking until someone notices it.
 *
 * Players are their melee player id and nothing else: no name, handle, email or
 * Discord. The deck's own name stays — it labels a deck, not a person — and so
 * does the archetype melee attached to it. `ResultString` is dropped because it
 * spells the winner's display name.
 *
 * Scrubbing happens in memory on the way out of the fetch; the raw payload is
 * never returned, logged or stored. The four `get…` functions are the only way
 * in: the raw fetches below are not exported, and `transport.server.ts` cannot
 * be imported from outside `lib/melee/` (`.dependency-cruiser.cjs`).
 */

export type Scrubbed<T> =
  { readonly status: "ok"; readonly value: T } | Exclude<MeleeFetch, { status: "ok" }>;

export interface MeleeRound {
  readonly id: number;
  readonly name: string;
  readonly sortOrder: number;
}

export interface MeleePhase {
  readonly id: number;
  readonly name: string;
  readonly formatId: string | null;
  readonly format: string | null;
  readonly sortOrder: number;
  readonly rounds: readonly MeleeRound[];
}

export interface MeleeTournament {
  readonly id: number;
  readonly guid: string | null;
  readonly name: string;
  readonly status: string | null;
  readonly organizationId: number | null;
  readonly formats: readonly string[];
  readonly lastPairedAt: string | null;
  readonly phases: readonly MeleePhase[];
}

export interface MeleeCompetitor {
  /** melee player ids; one per player, more than one only in team events. */
  readonly playerIds: readonly number[];
  readonly teamId: number | null;
  readonly gameWins: number;
  readonly gameByes: number;
  readonly decklistIds: readonly string[];
}

export interface MeleeMatch {
  readonly guid: string;
  readonly tournamentId: number;
  readonly phaseId: number | null;
  readonly roundId: number | null;
  readonly roundNumber: number | null;
  readonly hasResult: boolean;
  readonly gameDraws: number;
  /** "Best of Three" and the like. */
  readonly type: string | null;
  readonly byeReason: string | null;
  readonly competitors: readonly MeleeCompetitor[];
}

export interface MeleeCard {
  readonly name: string;
  readonly quantity: number;
  /** melee's category: `0` maindeck, `99` sideboard; anything else is kept as `other`. */
  readonly board: "main" | "side" | "other";
}

export interface MeleeDecklist {
  readonly guid: string;
  readonly tournamentId: number | null;
  readonly playerId: number | null;
  readonly teamId: number | null;
  readonly formatId: string | null;
  readonly format: string | null;
  readonly deckName: string | null;
  readonly archetypes: readonly string[];
  readonly isValid: boolean | null;
  /** The player's final standing, which melee carries on the decklist. */
  readonly rank: number | null;
  readonly matchWins: number | null;
  readonly matchLosses: number | null;
  readonly matchDraws: number | null;
  readonly cards: readonly MeleeCard[];
}

export async function getTournament(tournamentId: number): Promise<Scrubbed<MeleeTournament>> {
  return scrubWith(await fetchTournament(tournamentId), scrubTournament);
}

export async function getTournamentMatches(
  tournamentId: number,
): Promise<Scrubbed<readonly MeleeMatch[]>> {
  return scrubWith(await fetchTournamentMatches(tournamentId), (payload) =>
    listOf(payload, scrubMatch),
  );
}

export async function getTournamentDecklists(
  tournamentId: number,
): Promise<Scrubbed<readonly MeleeDecklist[]>> {
  return scrubWith(await fetchTournamentDecklists(tournamentId), (payload) =>
    listOf(payload, scrubDecklist),
  );
}

export async function getDecklist(decklistGuid: string): Promise<Scrubbed<MeleeDecklist>> {
  return scrubWith(await fetchDecklist(decklistGuid), scrubDecklist);
}

// ── Raw fetches ──────────────────────────────────────────────────────────────
// Private on purpose: each returns melee's payload with every personal field in
// it. Only the scrubbed `get…` functions above may call them.

/**
 * Enough for a 256-player, nine-round event. `HasMore` ends the loop long before
 * this in practice; the cap is what stops a server that always says "more" from
 * spending the whole rate limit.
 */
const MAX_RESULT_PAGES = 20;

/** One tournament: status, phases, and each phase's rounds and `FormatId`. No envelope. */
async function fetchTournament(tournamentId: number): Promise<MeleeFetch> {
  return await meleeGet(`/tournament/${tournamentId}`);
}

/** Every match, all rounds and phases, with both competitors and their decklist ids. */
async function fetchTournamentMatches(tournamentId: number): Promise<MeleeFetch> {
  return await meleeGetAllPages(`/match/list/${tournamentId}`, MAX_RESULT_PAGES);
}

/** Every decklist with its cards, and its player's final standing. */
async function fetchTournamentDecklists(tournamentId: number): Promise<MeleeFetch> {
  return await meleeGetAllPages(`/decklist/list/${tournamentId}`, MAX_RESULT_PAGES);
}

/** One decklist by GUID, in the same shape as a member of the tournament's list. */
async function fetchDecklist(decklistGuid: string): Promise<MeleeFetch> {
  return await meleeGet(`/decklist/${encodeURIComponent(decklistGuid)}`);
}

// ── Scrubbers ────────────────────────────────────────────────────────────────
// Pure, and exported for the tests. Each builds a new object from named fields;
// none spreads or copies the object it was given.

export function scrubTournament(raw: unknown): MeleeTournament | null {
  if (!isRecord(raw)) return null;
  const id = int(raw["ID"]);
  if (id === null) return null;

  return {
    id,
    guid: str(raw["Guid"]),
    name: str(raw["Name"])?.trim() ?? "",
    status: str(raw["StatusDescription"]),
    organizationId: int(raw["OrganizationId"]),
    formats: arrayOf(raw["Formats"], str),
    lastPairedAt: str(raw["LastPairDateTime"]),
    phases: arrayOf(raw["Phases"], scrubPhase),
  };
}

function scrubPhase(raw: unknown): MeleePhase | null {
  if (!isRecord(raw)) return null;
  const id = int(raw["ID"]);
  if (id === null) return null;

  return {
    id,
    name: str(raw["Name"]) ?? "",
    formatId: str(raw["FormatId"]),
    format: str(raw["Format"]),
    sortOrder: int(raw["SortOrder"]) ?? 0,
    rounds: arrayOf(raw["Rounds"], (round) => {
      if (!isRecord(round)) return null;
      const roundId = int(round["ID"]);
      return roundId === null
        ? null
        : { id: roundId, name: str(round["Name"]) ?? "", sortOrder: int(round["SortOrder"]) ?? 0 };
    }),
  };
}

export function scrubMatch(raw: unknown): MeleeMatch | null {
  if (!isRecord(raw)) return null;
  const guid = str(raw["Guid"]);
  const tournamentId = int(raw["TournamentId"]);
  if (guid === null || tournamentId === null) return null;

  return {
    guid,
    tournamentId,
    phaseId: int(raw["PhaseId"]),
    roundId: int(raw["RoundId"]),
    roundNumber: int(raw["RoundNumber"]),
    hasResult: raw["HasResult"] === true,
    gameDraws: int(raw["GameDraws"]) ?? 0,
    type: str(raw["TypeDescription"]),
    byeReason: str(raw["ByeReasonDescription"]),
    competitors: arrayOf(raw["Competitors"], scrubCompetitor),
  };
}

function scrubCompetitor(raw: unknown): MeleeCompetitor | null {
  if (!isRecord(raw)) return null;
  const team = isRecord(raw["Team"]) ? raw["Team"] : {};

  return {
    playerIds: arrayOf(team["Players"], (player) => (isRecord(player) ? int(player["ID"]) : null)),
    teamId: int(raw["TeamId"]),
    gameWins: int(raw["GameWins"]) ?? 0,
    gameByes: int(raw["GameByes"]) ?? 0,
    decklistIds: arrayOf(raw["Decklists"], (decklist) =>
      isRecord(decklist) ? str(decklist["DecklistId"]) : null,
    ),
  };
}

export function scrubDecklist(raw: unknown): MeleeDecklist | null {
  if (!isRecord(raw)) return null;
  const guid = str(raw["Guid"]);
  if (guid === null) return null;

  return {
    guid,
    tournamentId: int(raw["TournamentId"]),
    playerId: int(raw["PlayerId"]),
    teamId: int(raw["TeamId"]),
    formatId: str(raw["FormatId"]),
    format: str(raw["FormatName"]),
    deckName: str(raw["DecklistName"]),
    archetypes: arrayOf(raw["Attributes"], (attribute) =>
      isRecord(attribute) && attribute["k"] === "ARCHETYPE" ? str(attribute["v"]) : null,
    ),
    isValid: typeof raw["IsValid"] === "boolean" ? raw["IsValid"] : null,
    rank: int(raw["TeamRank"]),
    matchWins: int(raw["TeamMatchWins"]),
    matchLosses: int(raw["TeamMatchLosses"]),
    matchDraws: int(raw["TeamMatchDraws"]),
    cards: arrayOf(raw["Records"], scrubCard),
  };
}

function scrubCard(raw: unknown): MeleeCard | null {
  if (!isRecord(raw)) return null;
  const name = str(raw["n"]);
  const quantity = int(raw["q"]);
  if (name === null || quantity === null) return null;

  const category = int(raw["c"]);
  return { name, quantity, board: category === 0 ? "main" : category === 99 ? "side" : "other" };
}

// ── Plumbing ─────────────────────────────────────────────────────────────────

function scrubWith<T>(fetched: MeleeFetch, scrub: (payload: unknown) => T | null): Scrubbed<T> {
  if (fetched.status !== "ok") return fetched;
  const value = scrub(fetched.payload);
  return value === null
    ? { status: "failed", error: "melee returned a shape this scrubber does not recognise" }
    : { status: "ok", value };
}

function listOf<T>(payload: unknown, scrub: (raw: unknown) => T | null): readonly T[] | null {
  return isRecord(payload) && Array.isArray(payload["Content"])
    ? arrayOf(payload["Content"], scrub)
    : null;
}

function arrayOf<T>(value: unknown, pick: (item: unknown) => T | null): T[] {
  return Array.isArray(value) ? value.map(pick).filter((item): item is T => item !== null) : [];
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function int(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
