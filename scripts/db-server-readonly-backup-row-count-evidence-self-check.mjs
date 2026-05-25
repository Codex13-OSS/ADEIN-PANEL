#!/usr/bin/env node

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const phase = 'v053';
const mainScriptPath = new URL('./db-server-readonly-backup-row-count-evidence.mjs', import.meta.url);
const packageJsonPath = new URL('../package.json', import.meta.url);

const expectedAllowedTables = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const expectedForbiddenTables = [
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

const dangerousSqlTokens = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'COMMIT', 'ROLLBACK'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runMainDefault() {
  const result = spawnSync(process.execPath, [mainScriptPath.pathname], {
    env: { ...process.env },
    encoding: 'utf8'
  });

  assert(result.status === 0, `Default run must exit 0, got ${result.status}`);

  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    throw new Error('Default run output must be valid JSON.');
  }

  assert(payload.ok === true, 'ok must be true.');
  assert(payload.phase === phase, 'phase must be v053.');
  assert(payload.evidenceOnly === true, 'evidenceOnly must be true.');
  assert(payload.readOnly === true, 'readOnly must be true.');
  assert(payload.writesEnabled === false, 'writesEnabled must be false.');
  assert(payload.commitAllowed === false, 'commitAllowed must be false.');
  assert(payload.commitExecuted === false, 'commitExecuted must be false.');
  assert(payload.persistentWriteExecuted === false, 'persistentWriteExecuted must be false.');
  assert(payload.databaseConnectionAttempted === false, 'Default mode must not attempt DB connection.');

  assert(JSON.stringify(payload.allowedTables) === JSON.stringify(expectedAllowedTables), 'allowedTables mismatch.');
  assert(JSON.stringify(payload.forbiddenTables) === JSON.stringify(expectedForbiddenTables), 'forbiddenTables mismatch.');
}

function checkMainScriptSqlSafety() {
  const source = fs.readFileSync(mainScriptPath, 'utf8');
  const lines = source.split(/\r?\n/);

  for (const token of dangerousSqlTokens) {
    const offenders = lines.filter((line) => {
      const upper = line.toUpperCase();
      if (!upper.includes(token)) return false;

      const allowlistMarkers = [
        'blockedSqlTokens',
        'validateReadOnlyQuery',
        'unsafe query blocked',
        'noWriteSqlExecuted',
        'query not strictly select',
        'createconnection',
        'commitallowed',
        'commitexecuted',
        'persistentwriteexecuted'
      ];

      return !allowlistMarkers.some((marker) => upper.includes(marker.toUpperCase()));
    });

    assert(offenders.length === 0, `Potential unsafe SQL token usage detected for ${token}.`);
  }
}

function checkPackageScripts() {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  assert(
    pkg.scripts['db:server-readonly:evidence'] === 'node scripts/db-server-readonly-backup-row-count-evidence.mjs',
    'Missing or invalid db:server-readonly:evidence script.'
  );
  assert(
    pkg.scripts['db:server-readonly:evidence:self-check'] ===
      'node scripts/db-server-readonly-backup-row-count-evidence-self-check.mjs',
    'Missing or invalid db:server-readonly:evidence:self-check script.'
  );
}

function checkForbiddenPathsUntouched() {
  const disallowedFragments = ['/frontend/', '/ui/', '/auth/', '/login/', '/mobile/', '/documentos/', '/src/schema/'];
  const changedFilesResult = spawnSync('git', ['status', '--short'], { encoding: 'utf8' });
  assert(changedFilesResult.status === 0, 'Unable to read git status --short.');

  const changedFiles = changedFilesResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(3));

  for (const file of changedFiles) {
    const normalized = `/${file.replace(/\\/g, '/')}/`.toLowerCase();
    const touchedForbidden = disallowedFragments.some((fragment) => normalized.includes(fragment));
    assert(!touchedForbidden, `Forbidden path was modified: ${file}`);
  }
}

try {
  runMainDefault();
  checkMainScriptSqlSafety();
  checkPackageScripts();
  checkForbiddenPathsUntouched();

  process.stdout.write(`${JSON.stringify({ ok: true, phase, selfCheck: 'passed' }, null, 2)}\n`);
  process.exit(0);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ ok: false, phase, selfCheck: 'failed', error: error.message }, null, 2)}\n`);
  process.exit(1);
}
