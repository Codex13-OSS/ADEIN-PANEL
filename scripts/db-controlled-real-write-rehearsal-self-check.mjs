#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const SCRIPT = 'scripts/db-controlled-real-write-rehearsal.mjs';

function runCase(name, env = {}, expectCode = 0) {
  const result = spawnSync(process.execPath, [SCRIPT], {
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });

  let parsed;
  try {
    parsed = JSON.parse(result.stdout || '{}');
  } catch {
    throw new Error(`${name}: output is not valid JSON`);
  }

  if (result.status !== expectCode) {
    throw new Error(`${name}: expected exit ${expectCode} got ${result.status}`);
  }

  return parsed;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function main() {
  const defaultRun = runCase('default-dry-run');
  assert(defaultRun.ok === true, 'default-dry-run: ok must be true');
  assert(defaultRun.phase === 'v048', 'default-dry-run: phase must be v048');
  assert(defaultRun.dryRun === true, 'default-dry-run: dryRun must be true');
  assert(defaultRun.rollbackOnly === true, 'default-dry-run: rollbackOnly must be true');
  assert(defaultRun.commitAllowed === false, 'default-dry-run: commitAllowed must be false');
  assert(defaultRun.commitExecuted === false, 'default-dry-run: commitExecuted must be false');
  assert(defaultRun.persistentWriteExecuted === false, 'default-dry-run: persistentWriteExecuted must be false');
  assert(defaultRun.humanApprovalRequired === true, 'default-dry-run: humanApprovalRequired must be true');
  assert(JSON.stringify(defaultRun.tablesInScope) === JSON.stringify(['clients', 'properties', 'lots', 'contracts', 'payment_schedule']), 'default-dry-run: tablesInScope mismatch');
  for (const blocked of ['crm_users', 'sellers', 'crm_followups', 'import_batches', 'import_raw_rows', 'migration_plans', 'migration_plan_events', 'audit_log']) {
    assert(defaultRun.tablesBlocked.includes(blocked), `default-dry-run: missing blocked table ${blocked}`);
  }

  const negatives = [
    { name: 'reject-commit', env: { ADEIN_DB_COMMIT: '1' } },
    { name: 'reject-persistent-write', env: { ADEIN_DB_ALLOW_PERSISTENT_WRITE: '1' } },
    { name: 'reject-enable-writes', env: { ADEIN_DB_ENABLE_WRITES: '1' } },
    { name: 'reject-mode-write', env: { ADEIN_DB_MODE: 'write' } },
    { name: 'reject-mode-read-write', env: { ADEIN_DB_MODE: 'read_write' } },
    { name: 'reject-real-commit-gate', env: { ADEIN_DB_WRITE_GATE: 'REAL_COMMIT' } },
    { name: 'reject-rollback-missing-gates', env: { ADEIN_DB_MODE: 'rollback_only' } },
    { name: 'reject-rollback-missing-approval-token', env: { ADEIN_DB_MODE: 'rollback_only', ADEIN_DB_ROLLBACK_ONLY: '1', ADEIN_DB_WRITE_GATE: 'V048_ROLLBACK_REHEARSAL' } },
    { name: 'reject-rollback-wrong-approval-token', env: { ADEIN_DB_MODE: 'rollback_only', ADEIN_DB_ROLLBACK_ONLY: '1', ADEIN_DB_WRITE_GATE: 'V048_ROLLBACK_REHEARSAL', ADEIN_DB_APPROVAL_TOKEN: 'WRONG_TOKEN' } }
  ];

  for (const test of negatives) {
    const out = runCase(test.name, test.env, 1);
    assert(out.ok === false, `${test.name}: expected ok false`);
  }

  console.log(JSON.stringify({ ok: true, phase: 'v048', mode: 'self_check_controlled_real_write_rehearsal', checksPassed: 1 + negatives.length }, null, 2));
}

main();
