// Pure: RawInput in, ParsedEvent out. Depends on contracts + core only.
// E12.10 — one melee.gg event's results, as `lib/melee/results.server.ts` scrubbed them.

import type {
  Capability,
  IsoDate,
  ParseIssue,
  ParsedDecklistEntry,
  ParsedEvent,
  ParsedMatch,
  ParsedRosterEntry,
  ParsedStanding,
  RawInput,
  ResultsAdapter,
} from "@ps/contracts";

import { normalizeResult, type NormalizedResult } from "../normalize-result/index";
import { rawText } from "../raw-input/index";

/**
 * The site assembles this payload itself from three scrubbed fetches, so it can
 * label itself — the same reason `manual-entry` carries a tag. A raw melee
 * response never reaches this package: it names people, and `lib/melee/` keeps
 * it (E12.11).
 */
const ADAPTER_TAG = "melee-api";

const MELEE_WEB_BASE = "https://melee.gg/Tournament/View";

/** A phase that is a cut rather than more Swiss. melee names them; it has no flag. */
const ELIMINATION_PHASE = /playoff|top\s*\d+|elimination|bracket/i;

export const meleeApi: ResultsAdapter = {
  id: ADAPTER_TAG,
  capabilities: ["matches", "standings", "roster", "decklists"],
  detect,
  parse,
};

interface Round {
  readonly number: number;
  readonly isElimination: boolean;
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
          message: "The melee.gg results payload is not readable JSON with a tournament.",
        },
      ],
    };
  }

  const issues: ParseIssue[] = [];
  const rawMatches = asArray(payload["matches"]);
  const rawDecklists = asArray(payload["decklists"]);
  const handles = handlesById(rawMatches, rawDecklists, issues);
  const rounds = roundsById(tournament);

  const matches = rawMatches
    .map((raw, rowIndex) => readMatch(raw, rowIndex, handles, rounds, issues))
    .filter((match): match is ParsedMatch => match !== null);
  const standings = rawDecklists
    .map((raw) => readStanding(raw, handles))
    .filter((standing): standing is ParsedStanding => standing !== null);
  const decklists = rawDecklists
    .map((raw) => readDecklist(raw, handles, issues))
    .filter((decklist): decklist is ParsedDecklistEntry => decklist !== null);
  const roster = readRoster(handles, rawDecklists);

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
  if (decklists.length > 0) capabilities.push("decklists");

  const id = asInt(tournament["id"]);
  const name = asText(tournament["name"]);
  const date = asText(tournament["lastPairedAt"])?.slice(0, 10);
  const structure = structureOf(tournament);
  const roundCount = new Set([...rounds.values()].map((round) => round.number)).size;

  return {
    ...(name === undefined ? {} : { name }),
    ...(date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date: date as IsoDate } : {}),
    platform: "melee",
    ...(id === undefined ? {} : { externalUrl: `${MELEE_WEB_BASE}/${id}` }),
    ...(structure === undefined ? {} : { structure }),
    ...(roundCount === 0 ? {} : { rounds: roundCount }),
    ...(handles.size === 0 ? {} : { playerCount: new Set(handles.values()).size }),
    capabilities,
    ...(matches.length > 0 ? { matches } : {}),
    ...(standings.length > 0 ? { standings } : {}),
    ...(roster.length > 0 ? { roster } : {}),
    ...(decklists.length > 0 ? { decklists } : {}),
    issues,
  };
}

/**
 * melee player id → the handle a person is known by here. A player whose
 * username melee did not send still has to be somebody, so they get a stable
 * stand-in an admin can merge later, never a guess.
 */
function handlesById(
  rawMatches: readonly unknown[],
  rawDecklists: readonly unknown[],
  issues: ParseIssue[],
): Map<number, string> {
  const usernames = new Map<number, string | undefined>();
  const see = (id: number | undefined, username: string | undefined) => {
    if (id === undefined) return;
    if (username !== undefined || !usernames.has(id)) usernames.set(id, username);
  };

  for (const match of rawMatches) {
    for (const competitor of asArray(asRecord(match)?.["competitors"])) {
      for (const player of asArray(asRecord(competitor)?.["players"])) {
        const record = asRecord(player);
        see(asInt(record?.["id"]), asText(record?.["username"]));
      }
    }
  }
  for (const decklist of rawDecklists) {
    const record = asRecord(decklist);
    see(asInt(record?.["playerId"]), asText(record?.["username"]));
  }

  const handles = new Map<number, string>();
  for (const [id, username] of usernames) {
    if (username === undefined) {
      issues.push({
        code: "missing-username",
        severity: "warning",
        message: `melee sent no username for player ${id}; recorded as melee-player-${id}.`,
      });
    }
    handles.set(id, username ?? `melee-player-${id}`);
  }
  return handles;
}

/**
 * Round id → its place in the whole event. melee numbers `SortOrder` across
 * phases (Swiss 1–5, then quarterfinals 6), which is the order Elo replays in.
 */
function roundsById(tournament: Record<string, unknown>): Map<number, Round> {
  const rounds = new Map<number, Round>();
  for (const phase of asArray(tournament["phases"])) {
    const phaseRecord = asRecord(phase);
    const isElimination = ELIMINATION_PHASE.test(asText(phaseRecord?.["name"]) ?? "");
    for (const round of asArray(phaseRecord?.["rounds"])) {
      const record = asRecord(round);
      const id = asInt(record?.["id"]);
      const number = asInt(record?.["sortOrder"]);
      if (id !== undefined && number !== undefined) rounds.set(id, { number, isElimination });
    }
  }
  return rounds;
}

function readMatch(
  raw: unknown,
  rowIndex: number,
  handles: ReadonlyMap<number, string>,
  rounds: ReadonlyMap<number, Round>,
  issues: ParseIssue[],
): ParsedMatch | null {
  const match = asRecord(raw);
  if (match === null) return null;

  const sides = asArray(match["competitors"]).map(asRecord);
  const playerIds = sides.map((side) =>
    asArray(side?.["players"]).map((p) => asInt(asRecord(p)?.["id"])),
  );
  if (sides.length === 0 || sides.length > 2 || playerIds.some((ids) => ids.length !== 1)) {
    issues.push({
      code: "unreadable-pairing",
      severity: "error",
      message: "A match is not one player against at most one other; team events are not read.",
      rowIndex,
    });
    return null;
  }

  const [p1Id, p2Id] = playerIds.map((ids) => ids[0]);
  const p1Handle = handles.get(p1Id ?? -1);
  const p2Handle = p2Id === undefined ? undefined : handles.get(p2Id);
  if (p1Handle === undefined || (sides.length === 2 && p2Handle === undefined)) {
    issues.push({
      code: "missing-handle",
      severity: "error",
      message: "A match names a player melee did not identify.",
      rowIndex,
    });
    return null;
  }

  const round = rounds.get(asInt(match["roundId"]) ?? -1);
  const roundNumber = round?.number ?? asInt(match["roundNumber"]);
  const structure = {
    ...(roundNumber === undefined ? {} : { round: roundNumber }),
    ...(round === undefined ? {} : { isElimination: round.isElimination }),
  };
  const rawRow = {
    guid: asText(match["guid"]) ?? null,
    roundId: asInt(match["roundId"]) ?? null,
    p1PlayerId: p1Id ?? null,
    p2PlayerId: p2Id ?? null,
    p1GameWins: asInt(sides[0]?.["gameWins"]) ?? null,
    p2GameWins: asInt(sides[1]?.["gameWins"]) ?? null,
    gameDraws: asInt(match["gameDraws"]) ?? null,
    byeReason: asText(match["byeReason"]) ?? null,
  };

  // A bye is one competitor. melee also names a reason, but the missing
  // opponent is what makes it one (ADR 006).
  if (p2Handle === undefined) {
    return { rowIndex, raw: rawRow, p1Handle, result: "bye", ...structure };
  }

  const normalized: NormalizedResult =
    match["hasResult"] === true
      ? normalizeResult({
          p1Games: asInt(sides[0]?.["gameWins"]),
          p2Games: asInt(sides[1]?.["gameWins"]),
          gameDraws: asInt(match["gameDraws"]),
        })
      : { result: null };

  if (normalized.result === null) {
    issues.push({
      code: "unreadable-result",
      severity: "warning",
      message: `${p1Handle} vs ${p2Handle} has no result; the pairing stages for review.`,
      rowIndex,
    });
  }

  return {
    rowIndex,
    raw: rawRow,
    p1Handle,
    p2Handle,
    result: normalized.result,
    ...structure,
    ...(normalized.p1Games === undefined ? {} : { p1Games: normalized.p1Games }),
    ...(normalized.p2Games === undefined ? {} : { p2Games: normalized.p2Games }),
    ...(normalized.gameDraws === undefined ? {} : { gameDraws: normalized.gameDraws }),
  };
}

/** melee carries each player's final standing on their decklist, so no list means no standing. */
function readStanding(raw: unknown, handles: ReadonlyMap<number, string>): ParsedStanding | null {
  const decklist = asRecord(raw);
  const handle = handles.get(asInt(decklist?.["playerId"]) ?? -1);
  if (decklist === null || handle === undefined) return null;

  const placement = asInt(decklist["rank"]);
  const matchWins = asInt(decklist["matchWins"]);
  const matchLosses = asInt(decklist["matchLosses"]);
  const matchDraws = asInt(decklist["matchDraws"]);
  return {
    handle,
    ...(placement === undefined ? {} : { placement }),
    ...(matchWins === undefined ? {} : { matchWins }),
    ...(matchLosses === undefined ? {} : { matchLosses }),
    ...(matchDraws === undefined ? {} : { matchDraws }),
  };
}

function readDecklist(
  raw: unknown,
  handles: ReadonlyMap<number, string>,
  issues: ParseIssue[],
): ParsedDecklistEntry | null {
  const decklist = asRecord(raw);
  const handle = handles.get(asInt(decklist?.["playerId"]) ?? -1);
  if (decklist === null || handle === undefined) return null;

  const main: string[] = [];
  const side: string[] = [];
  for (const card of asArray(decklist["cards"])) {
    const record = asRecord(card);
    const name = asText(record?.["name"]);
    const quantity = asInt(record?.["quantity"]);
    if (name === undefined || quantity === undefined) continue;
    const board = record?.["board"];
    if (board === "main") main.push(`${quantity} ${name}`);
    else if (board === "side") side.push(`${quantity} ${name}`);
    else {
      issues.push({
        code: "unknown-board",
        severity: "warning",
        message: `${handle}'s ${name} is in a melee board that is neither main nor side; left out.`,
      });
    }
  }
  // A registered player with no cards submitted is a standing, not a decklist.
  if (main.length === 0) return null;

  const wins = asInt(decklist["matchWins"]);
  const losses = asInt(decklist["matchLosses"]);
  const draws = asInt(decklist["matchDraws"]) ?? 0;
  const deckName = asText(decklist["deckName"]);
  const archetypeRaw = asText(asArray(decklist["archetypes"])[0]);
  return {
    handle,
    decklistText:
      side.length === 0 ? main.join("\n") : [...main, "", "Sideboard", ...side].join("\n"),
    ...(wins === undefined || losses === undefined
      ? {}
      : { matchRecord: draws > 0 ? `${wins}-${losses}-${draws}` : `${wins}-${losses}` }),
    ...(deckName === undefined ? {} : { deckName }),
    ...(archetypeRaw === undefined ? {} : { archetypeRaw }),
  };
}

/** Everyone who played or registered a list, with what their list was called. */
function readRoster(
  handles: ReadonlyMap<number, string>,
  rawDecklists: readonly unknown[],
): ParsedRosterEntry[] {
  const decks = new Map<number, Record<string, unknown>>();
  for (const raw of rawDecklists) {
    const decklist = asRecord(raw);
    const id = asInt(decklist?.["playerId"]);
    if (decklist !== null && id !== undefined) decks.set(id, decklist);
  }

  return [...handles].map(([id, handle]) => {
    const deckName = asText(decks.get(id)?.["deckName"]);
    const archetypeRaw = asText(asArray(decks.get(id)?.["archetypes"])[0]);
    return {
      handle,
      ...(deckName === undefined ? {} : { deckName }),
      ...(archetypeRaw === undefined ? {} : { archetypeRaw }),
    };
  });
}

/** "swiss", or "swiss + top 8 playoffs" — the same spelling the calendar uses. */
function structureOf(tournament: Record<string, unknown>): string | undefined {
  const names = asArray(tournament["phases"])
    .map(asRecord)
    .filter((phase): phase is Record<string, unknown> => phase !== null)
    .sort((a, b) => (asInt(a["sortOrder"]) ?? 0) - (asInt(b["sortOrder"]) ?? 0))
    .map((phase) =>
      asText(phase["name"])
        ?.replace(/\s+phase$/i, "")
        .toLowerCase(),
    )
    .filter((name): name is string => name !== undefined);
  return names.length === 0 ? undefined : names.join(" + ");
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
