#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const VERSION = 'v033';
const fixturePath = resolve(process.cwd(), 'scripts/fixtures/import-staging-demo-v033.json');
const scriptPath = resolve(process.cwd(), 'scripts/db-import-staging-write-gate.mjs');
const blockedInsertTables = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule', 'migration_plans', 'migration_plan_events', 'audit_log'];
const destructivePattern = /DELETE FROM|DROP TABLE|TRUNCATE|ALTER TABLE|REPLACE INTO|UPDATE\s+.*\s+SET/i;
const insertPattern = /INSERT INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;

const checks = {
  fixtureExists: existsSync(fixturePath)
};

if (!checks.fixtureExists) {
  console.log(JSON.stringify({ ok: false, selfCheck: 'failed', version: VERSION, checks }, null, 2));
  process.exit(1);
}

const source = readFileSync(scriptPath, 'utf8');
checks.noDestructivePatternsInSource = !destructivePattern.test(source);

const inserts = [...source.matchAll(insertPattern)].map((match) => String(match[1]).toLowerCase());
checks.insertTargetsRestricted = inserts.every((name) => name === 'import_batches' || name === 'import_raw_rows');
checks.noForbiddenBusinessTableInInserts = !inserts.some((name) => blockedInsertTables.includes(name));

const run = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8', env: { ...process.env } });
checks.defaultExecutionExitCode = run.status === 0;

let payload = null;
try {
  payload = JSON.parse(run.stdout || '{}');
  checks.outputIsJson = true;
} catch {
  checks.outputIsJson = false;
}

checks.defaultModeDryRun = payload?.mode === 'dry_run';
checks.writesEnabledFalse = payload?.writesEnabled === false;
checks.executedFalse = payload?.executed === false;
checks.wouldInsertBatchesCountPresent = typeof payload?.wouldInsert?.import_batches?.count === 'number';
checks.wouldInsertRawRowsCountPresent = typeof payload?.wouldInsert?.import_raw_rows?.count === 'number';
checks.affectedTablesBusinessSafe = !Array.isArray(payload?.affectedTables)
  ? true
  : payload.affectedTables.every((tableName) => tableName === 'import_batches' || tableName === 'import_raw_rows');

const ok =
  checks.fixtureExists &&
  checks.noDestructivePatternsInSource &&
  checks.insertTargetsRestricted &&
  checks.noForbiddenBusinessTableInInserts &&
  checks.defaultExecutionExitCode &&
  checks.outputIsJson &&
  checks.defaultModeDryRun &&
  checks.writesEnabledFalse &&
  checks.executedFalse &&
  checks.wouldInsertBatchesCountPresent &&
  checks.wouldInsertRawRowsCountPresent &&
  checks.affectedTablesBusinessSafe;

if (!ok) {
  console.log(JSON.stringify({ ok: false, selfCheck: 'failed', version: VERSION, checks }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      selfCheck: 'passed',
      version: VERSION,
      defaultMode: 'dry_run',
      writesEnabled: false,
      checks
    },
    null,
    2
  )
);
