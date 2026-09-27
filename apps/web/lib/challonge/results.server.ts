import { challongeGet, challongeGetAllPages, type ChallongeFetch } from "./transport.server";

/**
 * Challonge tournament results with every personal detail removed (E12.13).
 *
 * A participants response carries the name a player registered under, their
 * email hash, avatar, check-in and more. None of it is ours to keep, so nothing
 * reads Challonge's results except through this file, and this file copies out an
 * **allowlist** — a Challonge id, a username, a result — rather than deleting a
 * blocklist. A field Challonge adds tomorrow is dropped until someone decides it
 * belongs here.
 *
 * A participant is their Challonge id and their Challonge username and nothing
 * else. The username is kept because identity needs a handle to resolve and an
 * admin needs one to merge, as with melee (E12.12); the free-text `name` is not,
 * since an organiser can type anything there, a real name included.
 *
 * Scrubbing happens in memory on the way out of the fetch; the raw payload is
 * never returned, logged or stored. `transport.server.ts` cannot be imported from
 * outside `lib/challonge/` (`.dependency-cruiser.cjs`).
 */

export type Scrubbed<T> =
  { readonly status: "ok"; readonly value: T } | Exclude<ChallongeFetch, { status: "ok" }>;

export interface ChallongeTournament {
  readonly id: string;
  readonly name: string | null;
  /** A slug, or now and then an absolute URL. */
  readonly url: string | null;
  /** "swiss", "single elimination", "double elimination", "round robin". */
  readonly tournamentType: string | null;
  readonly state: string | null;
  readonly startsAt: string | null;
  readonly completedAt: string | null;
  /** Groups first, then `tournamentType` as the bracket. */
  readonly groupStageEnabled: boolean;
}

export interface ChallongeParticipant {
  readonly id: string;
  readonly username: string | null;
  readonly finalRank: number | null;
}

export interface ChallongeMatch {
  readonly id: string;
  readonly state: string | null;
  /** Negative for a double-elimination losers' bracket round. */
  readonly round: number | null;
  /** "A", "B", … "AA"; restarts at "A" where a two-stage event's bracket begins. */
  readonly identifier: string | null;
  readonly player1Id: string | null;
  readonly player2Id: string | null;
  readonly winnerId: string | null;
  /** Games won per participant, summed across sets. */
  readonly gamesByParticipant: Readonly<Record<string, number>>;
  /** "2 - 1", from player 1's side. Used only when the per-participant points are missing. */
  readonly scores: string | null;
  readonly tie: boolean;
}

/**
 * A hundred is honoured and puts a Monthly in one page per list; the cap stops a
 * misbehaving API from spending the month's budget on one event.
 */
const PAGE_SIZE = 100;
const MAX_PAGES = 6;

export async function getTournament(id: string): Promise<Scrubbed<ChallongeTournament>> {
  const result = await challongeGet(`/tournaments/${encodeURIComponent(id)}.json`);
  if (result.status !== "ok") return result;

  const data = asRecord(asRecord(result.payload)?.["data"]);
  const attributes = asRecord(data?.["attributes"]);
  if (data === null || attributes === null) {
    return { status: "failed", error: "challonge returned a tournament with no attributes" };
  }
  const timestamps = asRecord(attributes["timestamps"]);
  return {
    status: "ok",
    value: {
      id: asId(data["id"]) ?? id,
      name: asText(attributes["name"]),
      url: asText(attributes["url"]),
      tournamentType: asText(attributes["tournament_type"]),
      state: asText(attributes["state"]),
      startsAt: asText(attributes["starts_at"]) ?? asText(timestamps?.["starts_at"]),
      completedAt: asText(attributes["completed_at"]) ?? asText(timestamps?.["completed_at"]),
      groupStageEnabled: attributes["group_stage_enabled"] === true,
    },
  };
}

export async function getParticipants(
  id: string,
): Promise<Scrubbed<readonly ChallongeParticipant[]>> {
  const result = await challongeGetAllPages(
    `/tournaments/${encodeURIComponent(id)}/participants.json`,
    { pageSize: PAGE_SIZE, maxPages: MAX_PAGES },
  );
  if (result.status !== "ok") return result;

  return {
    status: "ok",
    value: members(result.payload).flatMap((member) => {
      const participantId = asId(member["id"]);
      const attributes = asRecord(member["attributes"]);
      if (participantId === null || attributes === null) return [];
      return [
        {
          id: participantId,
          username: asText(attributes["username"]),
          finalRank: asInt(attributes["final_rank"]),
        },
      ];
    }),
  };
}

export async function getMatches(id: string): Promise<Scrubbed<readonly ChallongeMatch[]>> {
  const result = await challongeGetAllPages(`/tournaments/${encodeURIComponent(id)}/matches.json`, {
    pageSize: PAGE_SIZE,
    maxPages: MAX_PAGES,
  });
  if (result.status !== "ok") return result;

  return {
    status: "ok",
    value: members(result.payload).flatMap((member) => {
      const matchId = asId(member["id"]);
      const attributes = asRecord(member["attributes"]);
      if (matchId === null || attributes === null) return [];
      const relationships = asRecord(member["relationships"]);
      const player = (key: string) =>
        asId(asRecord(asRecord(relationships?.[key])?.["data"])?.["id"]);

      const points = asArray(attributes["points_by_participant"]).map(asRecord);
      const gamesByParticipant: Record<string, number> = {};
      for (const entry of points) {
        const participantId = asId(entry?.["participant_id"]);
        const scores = asArray(entry?.["scores"]).filter(
          (score): score is number => typeof score === "number",
        );
        if (participantId !== null && scores.length > 0) {
          gamesByParticipant[participantId] = scores.reduce((sum, score) => sum + score, 0);
        }
      }

      return [
        {
          id: matchId,
          state: asText(attributes["state"]),
          round: asInt(attributes["round"]),
          identifier: asText(attributes["identifier"]),
          // Group matches name their players under `relationships`; bracket matches only here.
          player1Id: player("player1") ?? asId(points[0]?.["participant_id"]),
          player2Id: player("player2") ?? asId(points[1]?.["participant_id"]),
          winnerId: asId(attributes["winner_id"]),
          gamesByParticipant,
          scores: asText(attributes["scores"]),
          tie: attributes["tie"] === true,
        },
      ];
    }),
  };
}

function members(payload: unknown): Record<string, unknown>[] {
  return asArray(asRecord(payload)?.["data"])
    .map(asRecord)
    .filter((member): member is Record<string, unknown> => member !== null);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Challonge sends ids as strings in `id` and as numbers everywhere else. */
function asId(value: unknown): string | null {
  if (typeof value === "number" && Number.isInteger(value)) return String(value);
  return asText(value);
}

function asInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}
