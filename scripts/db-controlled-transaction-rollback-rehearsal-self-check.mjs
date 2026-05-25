#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const scriptPath = path.join(process.cwd(), 'scripts', 'db-controlled-transaction-rollback-rehearsal.mjs');

function runScript(extraEnv = {}) {
  const result = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8', env: { ...process.env, ...extraEnv } });
  const data = JSON.parse(result.stdout || '{}');
  return { result, data };
}

function main() {
  const expectedTables = ['properties', 'lots', 'clients', 'contracts', 'payment_schedule'];
  const { result, data } = runScript();
  assert.equal(result.status, 0);
  assert.equal(data.ok, true);
  assert.equal(data.dryRun, true);
  assert.equal(data.rollbackOnly, true);
  assert.equal(data.rehearsalOnly, true);
  assert.equal(data.commitAllowed, false);
  assert.equal(data.commitAttempted, false);
  assert.equal(data.commitExecuted, false);
  assert.equal(data.persistentWriteExecuted, false);
  assert.equal(data.noPersistentWrite, true);
  assert.equal(data.syntheticDataOnly, true);
  assert.equal(data.realDataUsed, false);
  assert.deepEqual(data.allowedTables, expectedTables);
  assert.ok(Array.isArray(data.forbiddenTables) && data.forbiddenTables.includes('crm_users'));
  assert.equal(data.requiredBackup.path, '/root/adein-backups/adein_crm/v054/2026-05-25T20-36-55-317Z/adein_crm_v054_2026-05-25T20-36-55-317Z.sql');
  assert.equal(data.requiredBackup.expectedSha256, '3e9d503196a07df814e22a0f48d0aac196d257131220184a88461994a0db044d');
  assert.deepEqual(data.requiredCurrentRowCountsBeforeRehearsal, { clients: 0, properties: 0, lots: 0, contracts: 0, payment_schedule: 0 });

  const dangerousCases = [
    { ADEIN_DB_COMMIT: '1' },
    { ADEIN_DB_ALLOW_PERSISTENT_WRITE: '1' },
    { ADEIN_DB_ENABLE_WRITES: '1' },
    { ADEIN_DB_MODE: 'write' },
    { ADEIN_DB_MODE: 'read_write' },
    { ADEIN_DB_WRITE_GATE: 'REAL_COMMIT' },
    { ADEIN_DB_WRITE_GATE: 'V057_REAL_COMMIT' },
    { ADEIN_DB_APPROVAL_TOKEN: 'APPROVE_REAL_COMMIT' }
  ];

  for (const envCase of dangerousCases) {
    const blocked = runScript(envCase);
    assert.equal(blocked.result.status, 1);
    assert.equal(blocked.data.ok, false);
    assert.ok(!JSON.stringify(blocked.data).includes('ADEIN_DB_PASSWORD'));
  }

  const missingGate = runScript({ ADEIN_V057_ROLLBACK_REHEARSAL: '1' });
  assert.equal(missingGate.result.status, 1);
  assert.equal(missingGate.data.ok, false);

  const source = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(!source.includes('connection.commit('));
  assert.ok(!/[`'"]\s*COMMIT\s*[`'"]/i.test(source));
  assert.ok(!source.includes('psql'));
  assert.ok(!source.includes('postgres'));
  assert.ok(source.includes('mysql2/promise'));
  assert.ok(source.includes('ADEIN_DB_HOST'));
  assert.ok(source.includes('ADEIN_DB_PORT'));
  assert.ok(source.includes('ADEIN_DB_USER'));
  assert.ok(source.includes('ADEIN_DB_PASSWORD'));
  assert.ok(source.includes('ADEIN_DB_NAME'));

  process.stdout.write(`${JSON.stringify({ ok: true, phase: 'v057', mode: 'controlled_transaction_rollback_rehearsal_self_check', assertions: 'all_passed' }, null, 2)}\n`);
}

try { main(); } catch (error) {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: 'v057', mode: 'controlled_transaction_rollback_rehearsal_self_check', error: error.message }, null, 2)}\n`);
  process.exit(1);
}
