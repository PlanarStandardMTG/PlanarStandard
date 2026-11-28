import type {
  Capability,
  IsoDate,
  MatchResult,
  ParsedDecklistEntry,
  ParsedEvent,
  ParsedMatch,
  ParsedRosterEntry,
  ParsedStanding,
  ParseIssue,
  Run,
  RunEntrant,
  RunEntrantId,
  RunPairing,
  RunRound,
} from "@ps/contracts";

import { countedGames } from "../record/index";
import { runStandings } from "../standings/index";

export interface FinishedRun {
  readonly name: string;
  readonly date: IsoDate;
  readonly run: Pick<Run, "seed" | "topCut">;
  readonly entrants: readonly RunEntrant[];
  readonly rounds: readonly RunRound[];
  readonly pairings: readonly RunPairing[];
  /** Each entrant's deck as it locked when the run started (ADR 013). */
  readonly decklists: ReadonlyMap<RunEntrantId, string>;
}

/**
 * The handle an entrant's matches carry into the ledger: a member's profile handle, or
 * for a guest `run-guest-<entrant id>` — never their typed name, which an admin merges
 * later as with Challonge's unlinked players (§28, ADR 003).
 */
export function runEntrantHandle(entrant: Pick<RunEntrant, "id" | "handle">): string {
  return entrant.handle ?? `run-guest-${entrant.id}`;
}

function resultOf(pairing: RunPairing): MatchResult | null {
  if (pairing.p2EntrantId === null) return "bye";
  const games = countedGames(pairing);
  if (games === null) return null;
  if (games.p1Wins === games.p2Wins) return "draw";
  return games.p1Wins > games.p2Wins ? "p1_win" : "p2_win";
}

/** Final placings: the cut by how far each player got, champion first, then everyone else by Swiss standing. */
function finishOrder(
  swissOrder: readonly RunEntrantId[],
  cutPairings: readonly RunPairing[],
): RunEntrantId[] {
  const swissRank = new Map(swissOrder.map((id, i) => [id, i]));
  const reached = new Map<RunEntrantId, number>();
  for (const p of cutPairings) {
    for (const id of [p.p1EntrantId, p.p2EntrantId]) {
      if (id !== null) reached.set(id, Math.max(reached.get(id) ?? 0, p.round));
    }
  }
  const lastRound = Math.max(0, ...cutPairings.map((p) => p.round));
  const final = cutPairings.find((p) => p.round === lastRound && p.p2EntrantId !== null);
  const result = final === undefined ? null : resultOf(final);
  const champion =
    result === "p1_win" ? final?.p1EntrantId : result === "p2_win" ? final?.p2EntrantId : undefined;

  const cut = [...reached.keys()].sort(
    (a, b) =>
      Number(b === champion) - Number(a === champion) ||
      (reached.get(b) ?? 0) - (reached.get(a) ?? 0) ||
      (swissRank.get(a) ?? Infinity) - (swissRank.get(b) ?? Infinity),
  );
  return [...cut, ...swissOrder.filter((id) => !reached.has(id))];
}

/**
 * A finished run as the `ParsedEvent` every results source produces, so `ingest-event`
 * commits it like a melee.gg event (§28). Real pairings, so the event is rateable; a
 * payload with nothing in it is omitted rather than sent empty (ADR 006).
 */
export function toParsedEvent({
  name,
  date,
  run,
  entrants,
  rounds,
  pairings,
  decklists,
}: FinishedRun): ParsedEvent {
  const handleOf = new Map(entrants.map((e) => [e.id, runEntrantHandle(e)]));
  const handle = (id: RunEntrantId): string => handleOf.get(id) ?? `run-guest-${id}`;
  const kindOf = new Map(rounds.map((r) => [r.number, r.kind]));
  const isCut = (p: RunPairing): boolean => kindOf.get(p.round) === "elimination";
  const ordered = [...pairings].sort((a, b) => a.round - b.round || a.table - b.table);
  const issues: ParseIssue[] = [];

  const matches = ordered.map((pairing, rowIndex): ParsedMatch => {
    const games = pairing.games;
    const result = resultOf(pairing);
    if (result === null) {
      issues.push({
        code: "unconfirmed-result",
        severity: "warning",
        message: `Round ${pairing.round}, table ${pairing.table} has no confirmed result.`,
        rowIndex,
      });
    }
    const common = {
      rowIndex,
      raw: {
        pairingId: pairing.id,
        round: pairing.round,
        table: pairing.table,
        p1EntrantId: pairing.p1EntrantId,
        p2EntrantId: pairing.p2EntrantId,
        p1Wins: games?.p1Wins ?? null,
        p2Wins: games?.p2Wins ?? null,
        draws: games?.draws ?? null,
        status: pairing.status,
      },
      p1Handle: handle(pairing.p1EntrantId),
      round: pairing.round,
      tableNumber: pairing.table,
      isElimination: isCut(pairing),
    };
    if (pairing.p2EntrantId === null) return { ...common, result: "bye" };
    return {
      ...common,
      p2Handle: handle(pairing.p2EntrantId),
      result,
      ...(games === null
        ? {}
        : { p1Games: games.p1Wins, p2Games: games.p2Wins, gameDraws: games.draws }),
    };
  });

  const swiss = runStandings({
    entrants,
    pairings: pairings.filter((p) => !isCut(p)),
    seed: run.seed,
  });
  const order = finishOrder(
    swiss.map((s) => s.entrantId),
    pairings.filter(isCut),
  );
  const tally = new Map<
    RunEntrantId,
    { mw: number; ml: number; md: number; gw: number; gl: number }
  >(order.map((id) => [id, { mw: 0, ml: 0, md: 0, gw: 0, gl: 0 }]));
  for (const pairing of pairings) {
    const games = countedGames(pairing);
    if (games === null) continue;
    const sides: Array<[RunEntrantId | null, number, number]> = [
      [pairing.p1EntrantId, games.p1Wins, games.p2Wins],
      [pairing.p2EntrantId, games.p2Wins, games.p1Wins],
    ];
    for (const [id, won, lost] of sides) {
      const t = id === null ? undefined : tally.get(id);
      if (t === undefined) continue;
      t.gw += won;
      t.gl += lost;
      if (won > lost) t.mw += 1;
      else if (won < lost) t.ml += 1;
      else t.md += 1;
    }
  }
  const dropped = new Set(entrants.filter((e) => e.droppedAfterRound !== null).map((e) => e.id));
  const standings = order.map((id, i): ParsedStanding => {
    const t = tally.get(id);
    return {
      handle: handle(id),
      placement: i + 1,
      matchWins: t?.mw ?? 0,
      matchLosses: t?.ml ?? 0,
      matchDraws: t?.md ?? 0,
      gameWins: t?.gw ?? 0,
      gameLosses: t?.gl ?? 0,
      dropped: dropped.has(id),
    };
  });

  const listed = new Set(order);
  const roster: ParsedRosterEntry[] = entrants
    .filter((e) => listed.has(e.id))
    .map((e) => ({ handle: handle(e.id), displayName: e.displayName }));
  const decks: ParsedDecklistEntry[] = entrants.flatMap((e) => {
    const text = decklists.get(e.id);
    return listed.has(e.id) && text !== undefined && text.trim() !== ""
      ? [{ handle: handle(e.id), decklistText: text }]
      : [];
  });

  const capabilities: Capability[] = [];
  if (matches.length > 0) capabilities.push("matches");
  if (standings.length > 0) capabilities.push("standings");
  if (roster.length > 0) capabilities.push("roster");
  if (decks.length > 0) capabilities.push("decklists");
  const roundCount = new Set(pairings.map((p) => p.round)).size;
  const hasSwiss = rounds.some((r) => r.kind === "swiss");
  const hasCut = rounds.some((r) => r.kind === "elimination");

  return {
    name,
    date,
    platform: "site",
    structure: hasSwiss ? (hasCut ? `swiss + top ${run.topCut}` : "swiss") : "single elimination",
    ...(roundCount === 0 ? {} : { rounds: roundCount }),
    ...(listed.size === 0 ? {} : { playerCount: listed.size }),
    capabilities,
    ...(matches.length > 0 ? { matches } : {}),
    ...(standings.length > 0 ? { standings } : {}),
    ...(roster.length > 0 ? { roster } : {}),
    ...(decks.length > 0 ? { decklists: decks } : {}),
    issues,
  };
}
