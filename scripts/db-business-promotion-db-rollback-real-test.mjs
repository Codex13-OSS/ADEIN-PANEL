#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const PHASE = 'v042';
const LIVE_PHASE = 'v042';
const LIVE_SCRIPT = resolve(process.cwd(), 'scripts/db-business-promotion-db-rollback-live-test.mjs');

function fail(reason, details = {}) {
  return {
    ok: false,
    phase: PHASE,
    mode: 'verification_failed',
    reason,
    ...details
  };
}

function runLiveHarness() {
  const result = spawnSync(process.execPath, [LIVE_SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env }
  });

  let payload;
  try {
    payload = JSON.parse(result.stdout || '{}');
  } catch {
    return fail('live_harness_output_not_json', { rawStdout: (result.stdout || '').trim() });
  }

  if (result.status !== 0 && payload.mode !== 'rejected' && payload.mode !== 'error') {
    return fail('live_harness_non_zero_without_structured_mode', { liveHarnessExitCode: result.status, payload });
  }

  return { ok: true, payload, liveHarnessExitCode: result.status };
}

function verify(payload) {
  if (payload.phase !== LIVE_PHASE) return fail('unexpected_live_phase', { expected: LIVE_PHASE, actual: payload.phase });

  if (payload.mode === 'dry_run') {
    return {
      ok: true,
      phase: PHASE,
      mode: 'dry_run',
      liveHarnessPhase: payload.phase,
      liveTestEnabled: payload.liveTestEnabled,
      commitAllowed: payload.commitAllowed,
      commitExecuted: payload.commitExecuted,
      rollbackExecuted: payload.rollbackExecuted,
      persistedRowsAfterRollback: payload.persistedRowsAfterRollback ?? null,
      note: 'safe_default_no_db_execution'
    };
  }

  if (payload.mode !== 'db_rollback_live_test') {
    return fail('unexpected_mode_for_controlled_run', { mode: payload.mode, reason: payload.reason || null });
  }

  if (payload.databaseMode !== 'rollback_only') return fail('database_mode_not_rollback_only', { actual: payload.databaseMode });
  if (payload.liveTestEnabled !== true) return fail('live_test_not_enabled');
  if (payload.rollbackExecuted !== true) return fail('rollback_not_executed');
  if (payload.commitAllowed !== false) return fail('commit_allowed_must_be_false');
  if (payload.commitExecuted !== false) return fail('commit_executed_must_be_false');
  if (Number(payload.persistedRowsAfterRollback) !== 0) {
    return fail('persisted_rows_after_rollback_must_be_zero', { persistedRowsAfterRollback: payload.persistedRowsAfterRollback });
  }

  if ((payload.evidence?.token || '').includes('REHEARSAL_V042_') !== true) {
    return fail('evidence_token_missing_expected_prefix');
  }

  return {
    ok: true,
    phase: PHASE,
    mode: 'verified_controlled_real_execution',
    liveHarnessPhase: payload.phase,
    databaseMode: payload.databaseMode,
    rollbackExecuted: payload.rollbackExecuted,
    commitAllowed: payload.commitAllowed,
    commitExecuted: payload.commitExecuted,
    persistedRowsAfterRollback: payload.persistedRowsAfterRollback,
    tablesChecked: payload.tablesChecked || [],
    evidenceSummary: {
      token: payload.evidence?.token || null,
      insertedTables: payload.evidence?.insertedTables || [],
      afterCounts: payload.evidence?.afterCounts || null
    }
  };
}

const live = runLiveHarness();
if (!live.ok) {
  console.log(JSON.stringify(live, null, 2));
  process.exit(1);
}

const verified = verify(live.payload);
console.log(JSON.stringify(verified, null, 2));
if (!verified.ok) process.exit(1);
