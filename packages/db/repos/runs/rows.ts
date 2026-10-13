import type {
  FormatVersionId,
  PostedRunPairing,
  ProfileId,
  Run,
  RunEntrant,
  RunGames,
  RunResultChange,
  RunResultSnapshot,
  RunResultStatus,
  RunRound,
  RunRoundKind,
  RunState,
  TournamentId,
} from "@ps/contracts";

/** The run tables as PostgREST returns them. The snake_case shape stops at this file. */
export interface RunRow {
  readonly id: string;
  readonly name: string;
  readonly starts_at: string | null;
  readonly description: string | null;
  readonly organizer_id: string;
  readonly state: RunState;
  readonly seed: string;
  readonly swiss_rounds: number;
  readonly top_cut: number;
  readonly tournament_id: string | null;
  readonly tournament_run_formats: ReadonlyArray<{
    readonly format_version_id: string;
    readonly position: number;
  }>;
}

export const RUN_COLUMNS =
  "id, name, starts_at, description, organizer_id, state, seed, swiss_rounds, top_cut, " +
  "tournament_id, tournament_run_formats(format_version_id, position)";

export function toRun(row: RunRow): Run {
  return {
    id: row.id,
    name: row.name,
    startsAt: row.starts_at,
    description: row.description,
    formatVersionIds: [...row.tournament_run_formats]
      .sort((a, b) => a.position - b.position)
      .map((f) => f.format_version_id as FormatVersionId),
    tournamentId: row.tournament_id as TournamentId | null,
    organizerId: row.organizer_id as ProfileId,
    state: row.state,
    seed: row.seed,
    swissRounds: row.swiss_rounds,
    topCut: row.top_cut,
  };
}

export interface EntrantRow {
  readonly id: string;
  readonly run_id: string;
  readonly profile_id: string | null;
  readonly display_name: string;
  readonly handle: string | null;
  readonly checked_in: boolean;
  readonly dropped_after_round: number | null;
}

export const ENTRANT_COLUMNS =
  "id, run_id, profile_id, display_name, handle, checked_in, dropped_after_round";

export function toRunEntrant(row: EntrantRow): RunEntrant {
  return {
    id: row.id,
    runId: row.run_id,
    profileId: row.profile_id as ProfileId | null,
    displayName: row.display_name,
    handle: row.handle,
    checkedIn: row.checked_in,
    droppedAfterRound: row.dropped_after_round,
  };
}

export interface RoundRow {
  readonly id: string;
  readonly run_id: string;
  readonly number: number;
  readonly kind: RunRoundKind;
  readonly paired_at: string;
}

export const ROUND_COLUMNS = "id, run_id, number, kind, paired_at";

export function toRunRound(row: RoundRow): RunRound {
  return {
    id: row.id,
    runId: row.run_id,
    number: row.number,
    kind: row.kind,
    pairedAt: row.paired_at,
  };
}

export interface PairingRow {
  readonly id: string;
  readonly round_id: string;
  readonly table_number: number;
  readonly p1_entrant_id: string;
  readonly p2_entrant_id: string | null;
  readonly p1_wins: number | null;
  readonly p2_wins: number | null;
  readonly draws: number | null;
  readonly status: RunResultStatus;
  readonly reported_by: string | null;
  readonly confirmed_by: string | null;
  readonly run_rounds: { readonly number: number };
}

export const PAIRING_COLUMNS =
  "id, round_id, table_number, p1_entrant_id, p2_entrant_id, p1_wins, p2_wins, draws, status, " +
  "reported_by, confirmed_by, run_rounds(number)";

function gamesOf(row: {
  readonly p1_wins: number | null;
  readonly p2_wins: number | null;
  readonly draws: number | null;
}): RunGames | null {
  return row.p1_wins === null || row.p2_wins === null || row.draws === null
    ? null
    : { p1Wins: row.p1_wins, p2Wins: row.p2_wins, draws: row.draws };
}

export function toPostedRunPairing(row: PairingRow): PostedRunPairing {
  return {
    id: row.id,
    roundId: row.round_id,
    round: row.run_rounds.number,
    table: row.table_number,
    p1EntrantId: row.p1_entrant_id,
    p2EntrantId: row.p2_entrant_id,
    games: gamesOf(row),
    status: row.status,
    reportedBy: row.reported_by as ProfileId | null,
    confirmedBy: row.confirmed_by as ProfileId | null,
  };
}

interface SnapshotJson {
  readonly p1_wins: number | null;
  readonly p2_wins: number | null;
  readonly draws: number | null;
  readonly status: RunResultStatus;
}

export interface ResultChangeRow {
  readonly pairing_id: string;
  readonly changed_by: string | null;
  readonly before: SnapshotJson;
  readonly after: SnapshotJson;
  readonly created_at: string;
}

export const RESULT_CHANGE_COLUMNS = "pairing_id, changed_by, before, after, created_at";

const toSnapshot = (json: SnapshotJson): RunResultSnapshot => ({
  games: gamesOf(json),
  status: json.status,
});

export function toRunResultChange(row: ResultChangeRow): RunResultChange {
  return {
    pairingId: row.pairing_id,
    changedBy: row.changed_by as ProfileId | null,
    before: toSnapshot(row.before),
    after: toSnapshot(row.after),
    createdAt: row.created_at,
  };
}
