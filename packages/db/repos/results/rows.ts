import type {
  AdapterId,
  Capability,
  ColumnMapping,
  IdentityId,
  ImportStatus,
  JsonValue,
  LedgerMatch,
  Match,
  MatchCorrection,
  MatchCorrectionId,
  MatchId,
  MatchResult,
  ParseIssue,
  PlayerId,
  ProfileId,
  RawRow,
  ResultImport,
  ResultImportId,
  StagedMatch,
  StagedMatchId,
  TournamentId,
} from "@ps/contracts";

/**
 * The four ledger tables as PostgREST returns them, with the joins the reads
 * need. Kept next to the mappers: outside this module these are contract types,
 * and the snake_case shape of the tables is nobody else's business.
 */
export interface ResultImportRow {
  readonly id: string;
  readonly tournament_id: string;
  readonly adapter_id: string;
  readonly source_platform: string | null;
  readonly file_path: string | null;
  readonly file_name: string | null;
  readonly content_hash: string;
  readonly capabilities: readonly string[] | null;
  readonly column_mapping: unknown;
  readonly status: ImportStatus;
  readonly row_count: number | null;
  readonly stats: unknown;
  readonly errors: unknown;
  readonly uploaded_by: string | null;
  readonly created_at: string;
  readonly committed_at: string | null;
}

export interface StagedMatchRow {
  readonly id: string;
  readonly import_id: string;
  readonly row_index: number;
  readonly raw: unknown;
  readonly round: number | null;
  readonly table_number: number | null;
  readonly p1_handle: string | null;
  readonly p2_handle: string | null;
  readonly p1_games: number | null;
  readonly p2_games: number | null;
  readonly game_draws: number | null;
  readonly result: string | null;
  readonly is_elimination: boolean | null;
  readonly p1_identity_id: string | null;
  readonly p2_identity_id: string | null;
  readonly p1_method: string | null;
  readonly p2_method: string | null;
  readonly p1_confidence: number | string | null;
  readonly p2_confidence: number | string | null;
  readonly issues: unknown;
}

export interface MatchRow {
  readonly id: string;
  readonly tournament_id: string;
  readonly source_import_id: string | null;
  readonly round: number;
  readonly table_number: number | null;
  readonly p1_identity_id: string;
  readonly p2_identity_id: string | null;
  readonly p1_games: number | null;
  readonly p2_games: number | null;
  readonly game_draws: number | null;
  readonly result: MatchResult;
  readonly is_elimination: boolean;
  readonly created_at: string;
}

/** A match with both sides resolved and its tournament embedded — the replay read. */
export interface LedgerMatchRow {
  readonly id: string;
  readonly round: number;
  readonly p1_games: number | null;
  readonly p2_games: number | null;
  readonly game_draws: number | null;
  readonly result: MatchResult;
  readonly is_elimination: boolean;
  readonly p1: { readonly player_id: string } | null;
  readonly p2: { readonly player_id: string } | null;
  readonly tournament: {
    readonly id: string;
    readonly event_date: string;
    readonly weight: number | string;
  } | null;
}

export interface MatchCorrectionRow {
  readonly id: string;
  readonly match_id: string;
  readonly field: string;
  readonly old_value: unknown;
  readonly new_value: unknown;
  readonly reason: string;
  readonly corrected_by: string;
  readonly created_at: string;
}

export const IMPORT_COLUMNS =
  "id, tournament_id, adapter_id, source_platform, file_path, file_name, content_hash, " +
  "capabilities, column_mapping, status, row_count, stats, errors, uploaded_by, created_at, " +
  "committed_at";

export const STAGED_COLUMNS =
  "id, import_id, row_index, raw, round, table_number, p1_handle, p2_handle, p1_games, " +
  "p2_games, game_draws, result, is_elimination, p1_identity_id, p2_identity_id, p1_method, " +
  "p2_method, p1_confidence, p2_confidence, issues";

export const MATCH_COLUMNS =
  "id, tournament_id, source_import_id, round, table_number, p1_identity_id, p2_identity_id, " +
  "p1_games, p2_games, game_draws, result, is_elimination, created_at";

/**
 * Both identity joins need an explicit constraint hint. `matches` has two
 * foreign keys into `player_identities`, and PostgREST cannot guess which one an
 * unnamed embed means — it errors rather than picking, which is the right
 * failure and an opaque one to debug.
 */
export const LEDGER_MATCH_COLUMNS =
  "id, round, p1_games, p2_games, game_draws, result, is_elimination, " +
  "p1:player_identities!matches_p1_identity_id_fkey (player_id), " +
  "p2:player_identities!matches_p2_identity_id_fkey (player_id), " +
  "tournament:tournaments!inner (id, event_date, weight, season_id, is_rated, status)";

export const CORRECTION_COLUMNS =
  "id, match_id, field, old_value, new_value, reason, corrected_by, created_at";

export function toResultImport(row: ResultImportRow): ResultImport {
  return {
    id: row.id as ResultImportId,
    tournamentId: row.tournament_id as TournamentId,
    adapterId: row.adapter_id as AdapterId,
    sourcePlatform: row.source_platform,
    filePath: row.file_path,
    fileName: row.file_name,
    contentHash: row.content_hash,
    capabilities: (row.capabilities ?? []) as readonly Capability[],
    columnMapping: (row.column_mapping ?? null) as ColumnMapping | null,
    status: row.status,
    rowCount: row.row_count,
    stats: (row.stats ?? null) as JsonValue | null,
    errors: (row.errors ?? null) as JsonValue | null,
    uploadedBy: row.uploaded_by as ProfileId | null,
    createdAt: row.created_at,
    committedAt: row.committed_at,
  };
}

export function toStagedMatch(row: StagedMatchRow): StagedMatch {
  return {
    id: row.id as StagedMatchId,
    importId: row.import_id as ResultImportId,
    rowIndex: row.row_index,
    raw: (row.raw ?? {}) as RawRow,
    round: row.round,
    tableNumber: row.table_number,
    p1Handle: row.p1_handle,
    p2Handle: row.p2_handle,
    p1Games: row.p1_games,
    p2Games: row.p2_games,
    gameDraws: row.game_draws,
    result: row.result,
    isElimination: row.is_elimination ?? false,
    p1IdentityId: row.p1_identity_id as IdentityId | null,
    p2IdentityId: row.p2_identity_id as IdentityId | null,
    p1Method: row.p1_method,
    p2Method: row.p2_method,
    p1Confidence: toNumber(row.p1_confidence),
    p2Confidence: toNumber(row.p2_confidence),
    issues: (row.issues ?? []) as readonly ParseIssue[],
  };
}

export function toMatch(row: MatchRow): Match {
  return {
    id: row.id as MatchId,
    tournamentId: row.tournament_id as TournamentId,
    sourceImportId: row.source_import_id as ResultImportId | null,
    round: row.round,
    tableNumber: row.table_number,
    p1IdentityId: row.p1_identity_id as IdentityId,
    p2IdentityId: row.p2_identity_id as IdentityId | null,
    p1Games: row.p1_games ?? 0,
    p2Games: row.p2_games ?? 0,
    gameDraws: row.game_draws ?? 0,
    result: row.result,
    isElimination: row.is_elimination,
    createdAt: row.created_at,
  };
}

/**
 * Null when either the tournament or player 1 failed to embed.
 *
 * Both are `not null` columns with foreign keys, so this cannot happen against a
 * consistent database — but the alternative is a non-null assertion, and a
 * silently-dropped match is far easier to notice as a count that does not add up
 * than a replay that threw halfway through. The caller reports the difference.
 */
export function toLedgerMatch(row: LedgerMatchRow): LedgerMatch | null {
  const player1 = row.p1?.player_id;
  if (row.tournament == null || player1 === undefined) return null;

  return {
    matchId: row.id as MatchId,
    tournamentId: row.tournament.id as TournamentId,
    eventDate: row.tournament.event_date,
    tournamentWeight: Number(row.tournament.weight),
    round: row.round,
    p1PlayerId: player1 as PlayerId,
    p2PlayerId: (row.p2?.player_id ?? null) as PlayerId | null,
    p1Games: row.p1_games ?? 0,
    p2Games: row.p2_games ?? 0,
    gameDraws: row.game_draws ?? 0,
    result: row.result,
    isElimination: row.is_elimination,
  };
}

export function toMatchCorrection(row: MatchCorrectionRow): MatchCorrection {
  return {
    id: row.id as MatchCorrectionId,
    matchId: row.match_id as MatchId,
    field: row.field,
    oldValue: (row.old_value ?? null) as JsonValue | null,
    newValue: (row.new_value ?? null) as JsonValue | null,
    reason: row.reason,
    correctedBy: row.corrected_by as ProfileId,
    createdAt: row.created_at,
  };
}

/** `numeric` arrives as a number, or as a string when it is wide enough to need one. */
function toNumber(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}
