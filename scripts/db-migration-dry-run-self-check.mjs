#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const VERSION = 'v032';
const fixturePath = resolve(process.cwd(), 'scripts/fixtures/migration-plan-demo-v032.json');
const dryRunScript = resolve(process.cwd(), 'scripts/db-migration-dry-run.mjs');
const dangerousPattern = /INSERT INTO|UPDATE\s+.*\s+SET|DELETE FROM|DROP TABLE|TRUNCATE|ALTER TABLE|REPLACE INTO/i;
const requiredEntities = [
  'clients',
  'properties',
  'lots',
  'contracts',
  'payment_schedule',
  'import_batches',
  'import_raw_rows',
  'migration_plans',
  'audit_log'
];

const checks = {
  fixtureExists: existsSync(fixturePath)
};

if (!checks.fixtureExists) {
  console.log(JSON.stringify({ ok: false, selfCheck: 'failed', reason: 'Fixture demo not found.', version: VERSION }, null, 2));
  process.exit(1);
}

const run = spawnSync(process.execPath, [dryRunScript], { encoding: 'utf8' });
checks.dryRunExitCode = run.status === 0;
checks.dangerousPatternsAbsent = !dangerousPattern.test(`${run.stdout}\n${run.stderr}`);

let payload = null;
try {
  payload = JSON.parse(run.stdout || '{}');
  checks.outputIsJson = true;
} catch {
  checks.outputIsJson = false;
}

checks.modeDryRun = payload?.guard?.mode === 'dry_run';
checks.writesDisabled = payload?.guard?.writesEnabled === false;
checks.executedFalse = payload?.guard?.executed === false;
checks.databaseWritesAttemptedFalse = payload?.guard?.databaseWritesAttempted === false;
checks.wouldCreateCountsPresent = requiredEntities.every((entity) => typeof payload?.wouldCreate?.[entity]?.count === 'number');

const ok =
  checks.fixtureExists &&
  checks.dryRunExitCode &&
  checks.outputIsJson &&
  checks.modeDryRun &&
  checks.writesDisabled &&
  checks.executedFalse &&
  checks.databaseWritesAttemptedFalse &&
  checks.wouldCreateCountsPresent &&
  checks.dangerousPatternsAbsent;

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
      mode: 'dry_run',
      writesEnabled: false,
      checks
    },
    null,
    2
  )
);
