#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const artifactScriptPath = resolve(__dirname, 'db-minimum-persistent-write-approval-artifact.mjs');

function fail(message) {
  console.error(`[self-check] ${message}`);
  process.exit(1);
}

function parseJson(stdout, label) {
  try {
    return JSON.parse(stdout);
  } catch {
    fail(`${label} did not return valid JSON`);
  }
}

function runArtifact(env = {}) {
  return spawnSync(process.execPath, [artifactScriptPath], {
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
}

function assert(condition, message) {
  if (!condition) fail(message);
}

const baseRun = runArtifact();
assert(baseRun.status === 0, 'default artifact run must exit code 0');

const artifact = parseJson(baseRun.stdout, 'default artifact');
assert(artifact.ok === true, 'ok must be true');
assert(artifact.phase === 'v058', 'phase must be v058');
assert(artifact.dryRun === true, 'dryRun must be true');
assert(artifact.artifactOnly === true, 'artifactOnly must be true');
assert(artifact.commitAllowed === false, 'commitAllowed must be false');
assert(artifact.commitAttempted === false, 'commitAttempted must be false');
assert(artifact.commitExecuted === false, 'commitExecuted must be false');
assert(artifact.persistentWriteExecuted === false, 'persistentWriteExecuted must be false');
assert(artifact.databaseConnectionAttempted === false, 'databaseConnectionAttempted must be false');
assert(artifact.transactionOpened === false, 'transactionOpened must be false');
assert(artifact.noWriteSqlExecuted === true, 'noWriteSqlExecuted must be true');
assert(artifact.noPersistentWrite === true, 'noPersistentWrite must be true');

const expectedAllowed = ['properties', 'lots', 'clients', 'contracts', 'payment_schedule'];
assert(
  Array.isArray(artifact.allowedTables) &&
    artifact.allowedTables.length === expectedAllowed.length &&
    artifact.allowedTables.every((t, i) => t === expectedAllowed[i]),
  'allowedTables must contain only the 5 allowed tables in expected order'
);

const sensitiveForbidden = [
  'crm_users',
  'sellers',
  'crm_followups',
  'import_batches',
  'import_raw_rows',
  'migration_plans',
  'migration_plan_events',
  'audit_log',
  'any table not listed in allowedTables'
];
assert(
  Array.isArray(artifact.forbiddenTables) &&
    sensitiveForbidden.every((table) => artifact.forbiddenTables.includes(table)),
  'forbiddenTables must include sensitive tables and catch-all policy'
);

assert(artifact.requiredEvidence?.v056_1_controlledReadOnlyRowCountsFix, 'missing v056.1 evidence');
assert(artifact.requiredEvidence?.v057_controlledTransactionRollbackRehearsal, 'missing v057 evidence');
assert(artifact.requiredEvidence?.backup_v054, 'missing backup v054 evidence');

const dangerousEnvCases = [
  { ADEIN_DB_COMMIT: '1' },
  { ADEIN_DB_ALLOW_PERSISTENT_WRITE: '1' },
  { ADEIN_DB_ENABLE_WRITES: '1' },
  { ADEIN_DB_WRITES_ENABLED: 'true' },
  { ADEIN_DB_MODE: 'write' },
  { ADEIN_DB_MODE: 'read_write' },
  { ADEIN_DB_MODE: 'persistent_write' },
  { ADEIN_DB_WRITE_GATE: 'REAL_COMMIT' },
  { ADEIN_DB_WRITE_GATE: 'V058_REAL_COMMIT' },
  { ADEIN_DB_APPROVAL_TOKEN: 'APPROVE_REAL_COMMIT' },
  { ADEIN_V058_EXECUTE_COMMIT: '1' }
];

for (const envCase of dangerousEnvCases) {
  const res = runArtifact(envCase);
  assert(res.status === 1, `dangerous env ${Object.keys(envCase)[0]} must exit code 1`);
  const parsed = parseJson(res.stdout, `dangerous env ${Object.keys(envCase)[0]}`);
  assert(parsed.ok === false, `dangerous env ${Object.keys(envCase)[0]} must produce ok:false`);
}

const source = await readFile(artifactScriptPath, 'utf8');
const forbiddenSourcePatterns = [
  'connection.commit(',
  'DROP TABLE',
  'TRUNCATE',
  'ALTER TABLE',
  'CREATE TABLE',
  'DELETE FROM',
  'UPDATE',
  'openai',
  'gpt-4',
  'sk-'
];

for (const pattern of forbiddenSourcePatterns) {
  assert(!source.includes(pattern), `source must not contain forbidden pattern: ${pattern}`);
}

assert(!/\bSQL\s+COMMIT\b/.test(source), 'source must not contain SQL COMMIT statement');

console.log(
  JSON.stringify(
    {
      ok: true,
      phase: 'v058',
      selfCheck: 'db-minimum-persistent-write-approval-artifact-self-check',
      checksPassed: 20
    },
    null,
    2
  )
);
