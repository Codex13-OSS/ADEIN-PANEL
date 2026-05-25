#!/usr/bin/env node

import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const scriptPath = path.join(process.cwd(), 'scripts', 'db-controlled-minimum-persistent-write-candidate.mjs');

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
  const expectedBackupPath = '/root/adein-backups/adein_crm/v054/2026-05-25T20-36-55-317Z/adein_crm_v054_2026-05-25T20-36-55-317Z.sql';
  const expectedSha = '3e9d503196a07df814e22a0f48d0aac196d257131220184a88461994a0db044d';

  const { result, data } = runScript();
  assert.equal(result.status, 0);
  assert.equal(data.ok, true);
  assert.equal(data.dryRun, true);
  assert.equal(data.candidateOnly, true);
  assert.equal(data.writesEnabled, false);
  assert.equal(data.commitAllowed, false);
  assert.equal(data.commitExecuted, false);
  assert.equal(data.persistentWriteExecuted, false);
  assert.equal(data.noWriteSqlExecuted, true);
  assert.equal(data.syntheticDataOnly, true);
  assert.equal(data.realDataUsed, false);

  assert.deepEqual(data.allowedTables, ['properties', 'lots', 'clients', 'contracts', 'payment_schedule']);
  assert.ok(Array.isArray(data.forbiddenTables) && data.forbiddenTables.includes('crm_users'));

  assert.equal(data.requiredBackup.path, expectedBackupPath);
  assert.equal(data.requiredBackup.expectedSha256, expectedSha);

  assert.deepEqual(data.requiredCurrentRowCountsBeforeWrite, {
    clients: 0,
    properties: 0,
    lots: 0,
    contracts: 0,
    payment_schedule: 0
  });

  assert.equal(data.approvalGate.requiredToken, 'APPROVE_V056_MINIMUM_SYNTHETIC_PERSISTENT_WRITE');
  assert.equal(data.approvalGate.tokenProvided, false);
  assert.equal(data.approvalGate.commitStillBlocked, true);

  const dangerousCases = [
    { ADEIN_DB_COMMIT: '1' },
    { ADEIN_DB_ALLOW_PERSISTENT_WRITE: '1' },
    { ADEIN_DB_ENABLE_WRITES: '1' },
    { ADEIN_DB_MODE: 'write' },
    { ADEIN_DB_MODE: 'read_write' },
    { ADEIN_DB_WRITE_GATE: 'REAL_COMMIT' },
    { ADEIN_DB_WRITE_GATE: 'V056_REAL_COMMIT' },
    { ADEIN_DB_APPROVAL_TOKEN: 'APPROVE_REAL_COMMIT' },
    { ADEIN_DB_APPROVAL_TOKEN: 'APPROVE_V056_MINIMUM_SYNTHETIC_PERSISTENT_WRITE' }
  ];

  for (const envCase of dangerousCases) {
    const blocked = runScript(envCase);
    assert.equal(blocked.result.status, 1);
    assert.equal(blocked.data.ok, false);
  }

  process.stdout.write(`${JSON.stringify({ ok: true, phase: 'v056', mode: 'controlled_minimum_persistent_write_candidate_self_check', assertions: 'all_passed' }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: 'v056', mode: 'controlled_minimum_persistent_write_candidate_self_check', error: error.message }, null, 2)}\n`);
  process.exit(1);
}
