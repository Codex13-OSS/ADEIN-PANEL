#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const VERSION = 'v034';
const fixturePath = resolve(process.cwd(), 'scripts/fixtures/migration-plan-write-demo-v034.json');
const scriptPath = resolve(process.cwd(), 'scripts/db-migration-plan-write-gate.mjs');
const destructivePattern = /DELETE FROM|DROP TABLE|TRUNCATE|ALTER TABLE|REPLACE INTO|UPDATE\s+.*\s+SET/i;
const insertPattern = /INSERT INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
const blockedInsertTables = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule', 'import_batches', 'import_raw_rows', 'audit_log'];

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
checks.insertTargetsRestricted = inserts.every((name) => name === 'migration_plans' || name === 'migration_plan_events');
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
checks.wouldInsertPlansCountPresent = typeof payload?.wouldInsert?.migration_plans?.count === 'number';
checks.wouldInsertPlanEventsCountPresent = typeof payload?.wouldInsert?.migration_plan_events?.count === 'number';
checks.noBusinessTablesInAffectedTables = !Array.isArray(payload?.affectedTables)
  ? true
  : payload.affectedTables.every((tableName) => tableName === 'migration_plans' || tableName === 'migration_plan_events');

const ok = Object.values(checks).every(Boolean);

if (!ok) {
  console.log(JSON.stringify({ ok: false, selfCheck: 'failed', version: VERSION, checks }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  selfCheck: 'passed',
  version: VERSION,
  defaultMode: 'dry_run',
  writesEnabled: false,
  checks
}, null, 2));
