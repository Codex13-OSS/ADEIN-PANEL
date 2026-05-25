#!/usr/bin/env node

import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const scriptPath = path.join(process.cwd(), 'scripts', 'db-prewrite-approval-gate.mjs');

function runScript(extraEnv = {}) {
  const result = spawnSync('node', [scriptPath], {
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv }
  });

  let data;
  try {
    data = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Invalid JSON output: ${result.stdout}`);
  }
  return { result, data };
}

function main() {
  const { result, data } = runScript();
  assert.equal(result.status, 0);
  assert.equal(data.ok, true);
  assert.equal(data.dryRun, true);
  assert.equal(data.databaseConnectionAttempted, false);
  assert.equal(data.databaseConnected, false);
  assert.equal(data.writesEnabled, false);
  assert.equal(data.commitAllowed, false);
  assert.equal(data.commitExecuted, false);
  assert.equal(data.persistentWriteExecuted, false);
  assert.equal(data.noWriteSqlExecuted, true);
  assert.equal(data.productionPortTouched, false);
  assert.equal(data.productionHealthChecked, false);
  assert.equal(data.stagingHealthChecked, false);
  assert.ok(data.approvalArtifact);
  assert.ok(data.minimumPersistentWriteCandidate);

  const dangerousCases = [
    { ADEIN_DB_COMMIT: '1' },
    { ADEIN_DB_ALLOW_PERSISTENT_WRITE: '1' },
    { ADEIN_DB_ENABLE_WRITES: '1' },
    { ADEIN_DB_MODE: 'write' },
    { ADEIN_DB_MODE: 'read_write' },
    { ADEIN_DB_WRITE_GATE: 'REAL_COMMIT' },
    { ADEIN_DB_WRITE_GATE: 'V055_REAL_COMMIT' },
    { ADEIN_DB_APPROVAL_TOKEN: 'APPROVE_REAL_COMMIT' },
    { ADEIN_DB_APPROVAL_TOKEN: 'APPROVE_MINIMUM_PERSISTENT_WRITE_V056' }
  ];

  for (const envCase of dangerousCases) {
    const blocked = runScript(envCase);
    assert.equal(blocked.result.status, 1);
    assert.equal(blocked.data.ok, false);
  }

  process.stdout.write(`${JSON.stringify({ ok: true, phase: 'v055', name: 'prewrite_approval_gate_self_check', assertions: 'all_passed' }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: 'v055', name: 'prewrite_approval_gate_self_check', error: error.message }, null, 2)}\n`);
  process.exit(1);
}
