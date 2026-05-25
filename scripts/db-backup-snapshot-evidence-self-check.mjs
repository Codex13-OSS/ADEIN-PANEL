#!/usr/bin/env node

import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, 'scripts', 'db-backup-snapshot-evidence.mjs');

function runScript(extraEnv = {}) {
  const r = spawnSync('node', [scriptPath], {
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv }
  });

  let data;
  try {
    data = JSON.parse(r.stdout);
  } catch {
    throw new Error(`Invalid JSON output. stdout: ${r.stdout}`);
  }

  return { r, data };
}

function main() {
  const { r, data } = runScript();
  assert.equal(r.status, 0, 'default run must exit 0');
  assert.equal(data.ok, true);
  assert.equal(data.dryRun, true);
  assert.equal(data.databaseConnectionAttempted, false);
  assert.equal(data.backupAttempted, false);
  assert.equal(data.writesEnabled, false);
  assert.equal(data.commitAllowed, false);
  assert.equal(data.commitExecuted, false);
  assert.equal(data.persistentWriteExecuted, false);
  assert.equal(data.readOnly, true);
  assert.equal(data.evidenceOnly, true);

  const dangerousCases = [
    { ADEIN_DB_COMMIT: '1' },
    { ADEIN_DB_ALLOW_PERSISTENT_WRITE: '1' },
    { ADEIN_DB_ENABLE_WRITES: '1' },
    { ADEIN_DB_MODE: 'write' },
    { ADEIN_DB_MODE: 'read_write' },
    { ADEIN_DB_WRITE_GATE: 'REAL_COMMIT' },
    { ADEIN_DB_APPROVAL_TOKEN: 'APPROVE_REAL_COMMIT' }
  ];

  for (const envCase of dangerousCases) {
    const blocked = runScript(envCase);
    assert.equal(blocked.r.status, 1, `dangerous env must fail: ${JSON.stringify(envCase)}`);
    assert.equal(blocked.data.ok, false);
  }

  const plannedBackupDir = data.backup?.backupDir;
  assert.ok(plannedBackupDir, 'backup backupDir must exist');
  assert.ok(!plannedBackupDir.startsWith(repoRoot), 'backup dir must be outside repo');

  assert.deepEqual(data.allowedTables, ['clients', 'properties', 'lots', 'contracts', 'payment_schedule']);
  assert.ok(Array.isArray(data.forbiddenTables) && data.forbiddenTables.length > 0, 'forbidden tables must exist');

  process.stdout.write(
    `${JSON.stringify({ ok: true, phase: 'v054', name: 'controlled_backup_snapshot_evidence_self_check', assertions: 'all_passed' }, null, 2)}\n`
  );
}

try {
  main();
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ ok: false, phase: 'v054', name: 'controlled_backup_snapshot_evidence_self_check', error: error.message }, null, 2)}\n`
  );
  process.exit(1);
}
