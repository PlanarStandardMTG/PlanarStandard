import type {
  Capability,
  ColumnMapping,
  IdentityId,
  ImportStatus,
  JsonValue,
  LedgerMatch,
  Match,
  MatchCorrection,
  MatchId,
  NewMatch,
  ParseIssue,
  ProfileId,
  RawRow,
  ResultImport,
  ResultImportId,
  SeasonId,
  StagedMatch,
  StagedMatchId,
  TournamentId,
} from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CORRECTION_COLUMNS,
  IMPORT_COLUMNS,
  LEDGER_MATCH_COLUMNS,
  MATCH_COLUMNS,
  STAGED_COLUMNS,
  toLedgerMatch,
  toMatch,
  toMatchCorrection,
  toResultImport,
  toStagedMatch,
  type LedgerMatchRow,
  type MatchCorrectionRow,
  type MatchRow,
  type ResultImportRow,
  type StagedMatchRow,
} from "./rows";

/**
 * Reads and writes over the four ledger tables (E13.18).
 *
 * Split the way the tables are. `result_imports` and `staged_matches` are an
 * operator's workspace and have **no read policy at all**, so every function
 * touching them takes the service-role client — not as a convenience, but
 * because the anon client would get an empty result and no error. `matches` and
 * `match_corrections` are public record and read through the public client.
 */

// ── imports ──────────────────────────────────────────────────────────────────

export interface NewImport {
  readonly tournamentId: TournamentId;
  readonly adapterId: string;
  readonly contentHash: string;
  readonly capabilities: readonly Capability[];
  readonly sourcePlatform?: string | null;
  readonly filePath?: string | null;
  readonly fileName?: string | null;
  readonly columnMapping?: ColumnMapping | null;
  readonly rowCount?: number | null;
  readonly uploadedBy?: ProfileId | null;
}

/**
 * Record an upload. Fails on a re-upload of the same file for the same event.
 *
 * `unique (tournament_id, content_hash)` is doing the work, and the caller is
 * expected to have asked `findImportByContentHash` first — which makes this the
 * backstop for two operators uploading at once, not the primary check.
 */
export async function createImport(
  serviceClient: SupabaseClient,
  upload: NewImport,
): Promise<ResultImport> {
  const { data, error } = await serviceClient
    .from("result_imports")
    .insert({
      tournament_id: upload.tournamentId,
      adapter_id: upload.adapterId,
      content_hash: upload.contentHash,
      capabilities: upload.capabilities,
      source_platform: upload.sourcePlatform ?? null,
      file_path: upload.filePath ?? null,
      file_name: upload.fileName ?? null,
      column_mapping: upload.columnMapping ?? null,
      row_count: upload.rowCount ?? null,
      uploaded_by: upload.uploadedBy ?? null,
    })
    .select(IMPORT_COLUMNS)
    .single();

  if (error !== null) throw new Error(`createImport failed: ${error.message}`);
  return toResultImport(data as unknown as ResultImportRow);
}

/** The existing import of this exact file, if there is one. The idempotency check (E18.1). */
export async function findImportByContentHash(
  serviceClient: SupabaseClient,
  tournamentId: TournamentId,
  contentHash: string,
): Promise<ResultImport | null> {
  const { data, error } = await serviceClient
    .from("result_imports")
    .select(IMPORT_COLUMNS)
    .eq("tournament_id", tournamentId)
    .eq("content_hash", contentHash)
    .maybeSingle();

  if (error !== null) throw new Error(`findImportByContentHash failed: ${error.message}`);
  return data === null ? null : toResultImport(data as unknown as ResultImportRow);
}

export interface ImportProgress {
  readonly rowCount?: number;
  readonly capabilities?: readonly Capability[];
  readonly stats?: JsonValue;
  readonly errors?: JsonValue;
  /** Set only when moving to `committed`; the caller supplies the instant. */
  readonly committedAt?: string;
}

/** Move an import along, recording whatever the step learned. */
export async function updateImportStatus(
  serviceClient: SupabaseClient,
  importId: ResultImportId,
  status: ImportStatus,
  progress: ImportProgress = {},
): Promise<void> {
  const { error } = await serviceClient
    .from("result_imports")
    .update({
      status,
      ...(progress.rowCount !== undefined && { row_count: progress.rowCount }),
      ...(progress.capabilities !== undefined && { capabilities: progress.capabilities }),
      ...(progress.stats !== undefined && { stats: progress.stats }),
      ...(progress.errors !== undefined && { errors: progress.errors }),
      ...(progress.committedAt !== undefined && { committed_at: progress.committedAt }),
    })
    .eq("id", importId);

  if (error !== null) throw new Error(`updateImportStatus failed: ${error.message}`);
}

/**
 * Mark every other committed import of this event superseded (§26, E18.5).
 *
 * Supersession is a status change, never a delete: the raw bytes and the staged
 * rows of the old import stay exactly where they were, because the reason to
 * re-import is usually that the first parse was wrong and somebody will want to
 * see what it said.
 */
export async function supersedeOtherImports(
  serviceClient: SupabaseClient,
  tournamentId: TournamentId,
  keepImportId: ResultImportId,
): Promise<number> {
  const { data, error } = await serviceClient
    .from("result_imports")
    .update({ status: "superseded" })
    .eq("tournament_id", tournamentId)
    .neq("id", keepImportId)
    .eq("status", "committed")
    .select("id");

  if (error !== null) throw new Error(`supersedeOtherImports failed: ${error.message}`);
  return (data ?? []).length;
}

// ── staging ──────────────────────────────────────────────────────────────────

export interface NewStagedMatch {
  readonly rowIndex: number;
  readonly raw: RawRow;
  readonly round?: number | null;
  readonly tableNumber?: number | null;
  readonly p1Handle?: string | null;
  readonly p2Handle?: string | null;
  readonly p1Games?: number | null;
  readonly p2Games?: number | null;
  readonly gameDraws?: number | null;
  readonly result?: string | null;
  readonly isElimination?: boolean;
  readonly issues?: readonly ParseIssue[];
}

/**
 * Replace an import's staged rows with a fresh parse.
 *
 * Wholesale, because a re-parse of the same file is the whole truth about what
 * that file contains — the same reason a re-import supersedes (§26). Any
 * resolution an operator had already done is discarded with it, which is correct:
 * the row indices may not even mean the same thing after a parser fix.
 */
export async function replaceStagedMatches(
  serviceClient: SupabaseClient,
  importId: ResultImportId,
  rows: readonly NewStagedMatch[],
): Promise<void> {
  const { error: clearError } = await serviceClient
    .from("staged_matches")
    .delete()
    .eq("import_id", importId);

  if (clearError !== null) throw new Error(`replaceStagedMatches failed: ${clearError.message}`);
  if (rows.length === 0) return;

  const { error } = await serviceClient.from("staged_matches").insert(
    rows.map((row) => ({
      import_id: importId,
      row_index: row.rowIndex,
      raw: row.raw,
      round: row.round ?? null,
      table_number: row.tableNumber ?? null,
      p1_handle: row.p1Handle ?? null,
      p2_handle: row.p2Handle ?? null,
      p1_games: row.p1Games ?? null,
      p2_games: row.p2Games ?? null,
      game_draws: row.gameDraws ?? null,
      result: row.result ?? null,
      is_elimination: row.isElimination ?? false,
      issues: row.issues ?? [],
    })),
  );

  if (error !== null) throw new Error(`replaceStagedMatches failed: ${error.message}`);
}

/** An import's staged rows in source order — what the review queue renders. */
export async function listStagedMatches(
  serviceClient: SupabaseClient,
  importId: ResultImportId,
): Promise<readonly StagedMatch[]> {
  const { data, error } = await serviceClient
    .from("staged_matches")
    .select(STAGED_COLUMNS)
    .eq("import_id", importId)
    .order("row_index", { ascending: true });

  if (error !== null) throw new Error(`listStagedMatches failed: ${error.message}`);
  return (data as unknown as StagedMatchRow[]).map(toStagedMatch);
}

export interface SideResolution {
  readonly identityId: IdentityId | null;
  readonly method: string;
  readonly confidence: number;
}

/**
 * Write back what resolution decided about one staged row (E18.3).
 *
 * Per side, because one row routinely has a confident match on one handle and a
 * guess on the other, and the operator reviewing it needs to see which is which.
 * Omitting a side leaves it untouched — re-resolving player 1 must not silently
 * discard an operator's manual choice for player 2.
 */
export async function resolveStagedMatch(
  serviceClient: SupabaseClient,
  stagedId: StagedMatchId,
  sides: { readonly p1?: SideResolution; readonly p2?: SideResolution },
): Promise<void> {
  const { error } = await serviceClient
    .from("staged_matches")
    .update({
      ...(sides.p1 !== undefined && {
        p1_identity_id: sides.p1.identityId,
        p1_method: sides.p1.method,
        p1_confidence: sides.p1.confidence,
      }),
      ...(sides.p2 !== undefined && {
        p2_identity_id: sides.p2.identityId,
        p2_method: sides.p2.method,
        p2_confidence: sides.p2.confidence,
      }),
    })
    .eq("id", stagedId);

  if (error !== null) throw new Error(`resolveStagedMatch failed: ${error.message}`);
}

// ── the ledger ───────────────────────────────────────────────────────────────

/**
 * Replace an event's matches with the ones an import committed (E18.4, §26).
 *
 * Replacement rather than a merge, and this is the one function in the
 * repository that deletes ledger rows. It is safe only because the ledger is
 * fully derived from imports whose raw bytes are archived: what it removes can
 * be rebuilt from `result_imports` and `staged_matches`.
 *
 * Deletes then inserts, rather than inserting then pruning like `replaceEvents`
 * does. The order is forced: matches carry no natural key to upsert on, and a
 * window where an event briefly shows both parses would be a leaderboard built
 * on doubled results.
 */
export async function replaceTournamentMatches(
  serviceClient: SupabaseClient,
  tournamentId: TournamentId,
  importId: ResultImportId,
  matches: readonly NewMatch[],
): Promise<number> {
  const { error: clearError } = await serviceClient
    .from("matches")
    .delete()
    .eq("tournament_id", tournamentId);

  if (clearError !== null)
    throw new Error(`replaceTournamentMatches failed clearing: ${clearError.message}`);
  if (matches.length === 0) return 0;

  const { data, error } = await serviceClient
    .from("matches")
    .insert(
      matches.map((match) => ({
        tournament_id: tournamentId,
        source_import_id: importId,
        round: match.round,
        table_number: match.tableNumber,
        p1_identity_id: match.p1IdentityId,
        p2_identity_id: match.p2IdentityId,
        p1_games: match.p1Games,
        p2_games: match.p2Games,
        game_draws: match.gameDraws,
        result: match.result,
        is_elimination: match.isElimination,
      })),
    )
    .select("id");

  if (error !== null) throw new Error(`replaceTournamentMatches failed: ${error.message}`);
  return (data ?? []).length;
}

/** One event's matches in playing order — the tournament page. */
export async function listMatchesByTournament(
  client: SupabaseClient,
  tournamentId: TournamentId,
): Promise<readonly Match[]> {
  const { data, error } = await client
    .from("matches")
    .select(MATCH_COLUMNS)
    .eq("tournament_id", tournamentId)
    .order("round", { ascending: true })
    .order("table_number", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (error !== null) throw new Error(`listMatchesByTournament failed: ${error.message}`);
  return (data as unknown as MatchRow[]).map(toMatch);
}

export interface LedgerRead {
  readonly matches: readonly LedgerMatch[];
  /**
   * Rows whose tournament or player-1 join came back empty. Always zero against
   * a consistent database; reported rather than thrown so a replay that is
   * missing matches says so instead of silently rating fewer.
   */
  readonly unresolved: number;
}

/**
 * Every rated match of a season, resolved to players, in replay order.
 *
 * The read `core/elo/replay` consumes. Two things it does that are the whole
 * reason it lives here rather than in the service:
 *
 * **It resolves identities to players.** The ledger stores handles (ADR 003);
 * `LedgerMatch` names players. That translation happens exactly here, at read
 * time, which is why a merge changes every rating and rewrites no history.
 *
 * **It orders by date, then round, then match id.** Elo is path-dependent, so
 * this ordering is a contract and not a convenience: a different order is a
 * different leaderboard, silently (ADR 004, E8.4). The match id breaks ties so
 * two matches in one round replay reproducibly.
 */
export async function listLedgerMatchesBySeason(
  client: SupabaseClient,
  seasonId: SeasonId,
): Promise<LedgerRead> {
  const { data, error } = await client
    .from("matches")
    .select(LEDGER_MATCH_COLUMNS)
    .eq("tournament.season_id", seasonId)
    .eq("tournament.is_rated", true)
    .in("tournament.status", ["results_imported", "verified"]);

  if (error !== null) throw new Error(`listLedgerMatchesBySeason failed: ${error.message}`);

  const rows = data as unknown as LedgerMatchRow[];
  const matches = rows.map(toLedgerMatch).filter((match) => match !== null);

  // Sorted here rather than in the query: PostgREST cannot order by a column of
  // an embedded resource, and `event_date` is one. The set is a season of
  // matches — low thousands at most — so this is cheaper than the round trip it
  // would take to avoid it.
  matches.sort(
    (a, b) =>
      a.eventDate.localeCompare(b.eventDate) ||
      a.round - b.round ||
      a.matchId.localeCompare(b.matchId),
  );

  return { matches, unresolved: rows.length - matches.length };
}

// ── corrections ──────────────────────────────────────────────────────────────

export interface NewCorrection {
  readonly matchId: MatchId;
  readonly field: string;
  readonly oldValue: JsonValue | null;
  readonly newValue: JsonValue | null;
  readonly reason: string;
  readonly correctedBy: ProfileId;
}

/**
 * Append to the correction log. Nothing updates or deletes a row here.
 *
 * The reason is required by the column, and this refuses an empty one too: a
 * whitespace string satisfies `not null` and explains nothing, which defeats the
 * only purpose the table has (E18.6).
 */
export async function recordMatchCorrection(
  serviceClient: SupabaseClient,
  correction: NewCorrection,
): Promise<MatchCorrection> {
  if (correction.reason.trim() === "") {
    throw new Error("recordMatchCorrection requires a reason");
  }

  const { data, error } = await serviceClient
    .from("match_corrections")
    .insert({
      match_id: correction.matchId,
      field: correction.field,
      old_value: correction.oldValue,
      new_value: correction.newValue,
      reason: correction.reason,
      corrected_by: correction.correctedBy,
    })
    .select(CORRECTION_COLUMNS)
    .single();

  if (error !== null) throw new Error(`recordMatchCorrection failed: ${error.message}`);
  return toMatchCorrection(data as unknown as MatchCorrectionRow);
}

/** Every edit made to one match, oldest first — the history, in order. */
export async function listMatchCorrections(
  client: SupabaseClient,
  matchId: MatchId,
): Promise<readonly MatchCorrection[]> {
  const { data, error } = await client
    .from("match_corrections")
    .select(CORRECTION_COLUMNS)
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });

  if (error !== null) throw new Error(`listMatchCorrections failed: ${error.message}`);
  return (data as unknown as MatchCorrectionRow[]).map(toMatchCorrection);
}
