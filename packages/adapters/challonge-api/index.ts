// Pure: RawInput in, ParsedEvent out. Depends on contracts + core only.
// E12.14 — one Challonge event's results, as `lib/challonge/results.server.ts` scrubbed them.

import type {
  Capability,
  IsoDate,
  ParseIssue,
  ParsedEvent,
  ParsedMatch,
  ParsedRosterEntry,
  ParsedStanding,
  RawInput,
  ResultsAdapter,
} from "@ps/contracts";

import { normalizeResult, type NormalizedResult } from "../normalize-result/index";
import { rawText } from "../raw-input/index";

/** The site assembles this payload itself, so it labels itself, as `melee-api`'s does. */
const ADAPTER_TAG = "challonge-api";

/** Where a bare `url` slug resolves to, as the calendar resolves it. */
const CHALLONGE_WEB_BASE = "https://challonge.com";

const ELIMINATION_TYPE = /elimination/i;

export const challongeApi: ResultsAdapter = {
  id: ADAPTER_TAG,
  // Challonge has no decklists; the admin's sheet brings them (E20.37).
  capabilities: ["matches", "standings", "roster"],
  detect,
  parse,
};

interface Participant {
  readonly id: string;
  readonly handle: string;
  readonly finalRank: number | undefined;
}

function detect(input: RawInput): boolean {
  return readPayload(input)?.["adapter"] === ADAPTER_TAG;
}

function parse(input: RawInput): ParsedEvent {
  const payload = readPayload(input);
  const tournament = payload === null ? null : asRecord(payload["tournament"]);
  if (payload === null || tournament === null) {
    return {
      capabilities: [],
      issues: [
        {
          code: "unreadable-payload",
          severity: "error",
          message: "The Challonge results payload is not readable JSON with a tournament.",
        },
      ],
    };
  }

  const issues: ParseIssue[] = [];
  const byId = readParticipants(asArray(payload["participants"]), issues);

  const rawMatches = asArray(payload["matches"]).map(asRecord);
  const type = asText(tournament["tournamentType"]);
  const twoStage = tournament["groupStageEnabled"] === true;
  const order = roundOrder(rawMatches, type, twoStage);

  const matches = rawMatches
    .map((raw, rowIndex) => readMatch(raw, rowIndex, byId, order, issues))
    .filter((match): match is ParsedMatch => match !== null);
  const people = [...byId.values()];
  const standings = people.flatMap((person): ParsedStanding[] =>
    person.finalRank === undefined ? [] : [{ handle: person.handle, placement: person.finalRank }],
  );
  const roster = people.map((person): ParsedRosterEntry => ({ handle: person.handle }));

  if (matches.length === 0) {
    issues.push({
      code: "no-matches",
      severity: "error",
      message: "The event reported no matches.",
    });
  }

  const capabilities: Capability[] = [];
  if (matches.length > 0) capabilities.push("matches");
  if (standings.length > 0) capabilities.push("standings");
  if (roster.length > 0) capabilities.push("roster");

  const name = asText(tournament["name"]);
  const date = (asText(tournament["completedAt"]) ?? asText(tournament["startsAt"]))?.slice(0, 10);
  const externalUrl = resolveUrl(asText(tournament["url"]));
  const rounds = new Set(matches.map((match) => match.round).filter((round) => round !== undefined))
    .size;

  return {
    ...(name === undefined ? {} : { name }),
    ...(date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date: date as IsoDate } : {}),
    platform: "challonge",
    ...(externalUrl === undefined ? {} : { externalUrl }),
    ...(type === undefined
      ? {}
      : { structure: `${twoStage ? "groups + " : ""}${type.toLowerCase()}` }),
    ...(rounds === 0 ? {} : { rounds }),
    ...(people.length === 0 ? {} : { playerCount: people.length }),
    capabilities,
    ...(matches.length > 0 ? { matches } : {}),
    ...(standings.length > 0 ? { standings } : {}),
    ...(roster.length > 0 ? { roster } : {}),
    issues,
  };
}

/**
 * Participant id → who they are here. A participant with no Challonge account has
 * no username: they go in under `knownAs`, the handle the site already knew their
 * typed name as (E12.15), or else a stable stand-in an admin can merge later —
 * never their free-text name.
 */
function readParticipants(raw: readonly unknown[], issues: ParseIssue[]): Map<string, Participant> {
  const byId = new Map<string, Participant>();
  for (const entry of raw) {
    const record = asRecord(entry);
    const id = asText(record?.["id"]);
    if (record === null || id === undefined) continue;

    const username = asText(record["username"]) ?? asText(record["knownAs"]);
    if (username === undefined) {
      issues.push({
        code: "missing-username",
        severity: "warning",
        message: `Challonge participant ${id} has no account; recorded as challonge-player-${id}.`,
      });
    }
    const participant = {
      id,
      handle: username ?? `challonge-player-${id}`,
      finalRank: asInt(record["finalRank"]),
    };
    byId.set(id, participant);
  }
  return byId;
}

interface RoundOrder {
  /** A match's place in the whole event, which is the order Elo replays in. */
  readonly number: (rowIndex: number) => number | undefined;
  readonly isElimination: (rowIndex: number) => boolean;
}

/**
 * A two-stage event lists its group matches, then its bracket's, and the
 * bracket restarts its rounds at 1 and its identifiers at "A" — nothing else in
 * v2.1 says which stage a match is in (`suggested_play_order` is mostly null in
 * a group stage). So the bracket starts at the second "A", and its rounds are
 * numbered after the groups'. A losers' round (negative) sits with its winners'.
 */
function roundOrder(
  matches: readonly (Record<string, unknown> | null)[],
  type: string | undefined,
  twoStage: boolean,
): RoundOrder {
  const restart = matches.findIndex((match, i) => i > 0 && asText(match?.["identifier"]) === "A");
  const bracketFrom = !twoStage ? 0 : restart === -1 ? matches.length : restart;
  const round = (i: number) => Math.abs(asInt(matches[i]?.["round"]) ?? 0);
  const groupRounds = Math.max(0, ...matches.slice(0, bracketFrom).map((_, i) => round(i)));
  const bracket = type !== undefined && ELIMINATION_TYPE.test(type);

  return {
    number: (i) => {
      if (round(i) === 0) return undefined;
      return round(i) + (i >= bracketFrom ? groupRounds : 0);
    },
    isElimination: (i) => i >= bracketFrom && bracket,
  };
}

function readMatch(
  match: Record<string, unknown> | null,
  rowIndex: number,
  participants: ReadonlyMap<string, Participant>,
  order: RoundOrder,
  issues: ParseIssue[],
): ParsedMatch | null {
  if (match === null) return null;

  const p1Id = asText(match["player1Id"]);
  const p2Id = asText(match["player2Id"]);
  const complete = asText(match["state"]) === "complete";
  // A bracket slot waiting on an earlier result is not a pairing yet.
  if (!complete && (p1Id === undefined || p2Id === undefined)) return null;

  const p1 = p1Id === undefined ? undefined : participants.get(p1Id);
  const p2 = p2Id === undefined ? undefined : participants.get(p2Id);
  const first = p1 ?? p2;
  if (
    first === undefined ||
    (p1Id !== undefined && p1 === undefined) ||
    (p2Id !== undefined && p2 === undefined)
  ) {
    issues.push({
      code: "missing-handle",
      severity: "error",
      message: "A match names a participant Challonge did not list.",
      rowIndex,
    });
    return null;
  }

  const round = order.number(rowIndex);
  const structure = {
    ...(round === undefined ? {} : { round }),
    isElimination: order.isElimination(rowIndex),
  };
  const games = asRecord(match["gamesByParticipant"]) ?? {};
  const rawRow = {
    id: asText(match["id"]) ?? null,
    round: asInt(match["round"]) ?? null,
    identifier: asText(match["identifier"]) ?? null,
    p1ParticipantId: p1Id ?? null,
    p2ParticipantId: p2Id ?? null,
    winnerId: asText(match["winnerId"]) ?? null,
    scores: asText(match["scores"]) ?? null,
    state: asText(match["state"]) ?? null,
  };

  // One side and no opponent: the other slot was never filled (ADR 006).
  if (p1 === undefined || p2 === undefined) {
    return { rowIndex, raw: rawRow, p1Handle: first.handle, result: "bye", ...structure };
  }

  const normalized: NormalizedResult & { readonly overruled?: true } = complete
    ? readResult(match, p1Id as string, p2Id as string, games)
    : { result: null };
  if (normalized.overruled) {
    issues.push({
      code: "score-disagrees",
      severity: "warning",
      message: `${p1.handle} vs ${p2.handle}: the score disagrees with the reported winner; the winner stands.`,
      rowIndex,
    });
  }
  if (normalized.result === null) {
    issues.push({
      code: "unreadable-result",
      severity: "warning",
      message: `${p1.handle} vs ${p2.handle} has no result; the pairing stages for review.`,
      rowIndex,
    });
  }

  return {
    rowIndex,
    raw: rawRow,
    p1Handle: p1.handle,
    p2Handle: p2.handle,
    result: normalized.result,
    ...structure,
    ...(normalized.p1Games === undefined ? {} : { p1Games: normalized.p1Games }),
    ...(normalized.p2Games === undefined ? {} : { p2Games: normalized.p2Games }),
  };
}

/**
 * The games when Challonge has them, checked against `winner_id`. An organiser
 * can report a winner without a score, and a winner is what decides a rating, so
 * where the two disagree the winner stands and the games are left out.
 */
function readResult(
  match: Record<string, unknown>,
  p1Id: string,
  p2Id: string,
  games: Record<string, unknown>,
): NormalizedResult & { readonly overruled?: true } {
  const p1Games = asInt(games[p1Id]);
  const p2Games = asInt(games[p2Id]);
  const fromScores =
    p1Games !== undefined && p2Games !== undefined
      ? normalizeResult({ p1Games, p2Games })
      : normalizeResult({ result: asText(match["scores"]) });

  const winnerId = asText(match["winnerId"]);
  const winner =
    winnerId === p1Id
      ? "p1_win"
      : winnerId === p2Id
        ? "p2_win"
        : match["tie"] === true
          ? "draw"
          : null;
  if (winner === null || winner === fromScores.result) return fromScores;
  return fromScores.result === null ? { result: winner } : { result: winner, overruled: true };
}

/** `url` is normally a slug, but the API has been seen returning an absolute URL. */
function resolveUrl(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${CHALLONGE_WEB_BASE}/${url.replace(/^\/+/, "")}`;
}

function readPayload(input: RawInput): Record<string, unknown> | null {
  const text = rawText(input).trim();
  if (!text.startsWith("{")) return null;
  try {
    return asRecord(JSON.parse(text));
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function asInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}
