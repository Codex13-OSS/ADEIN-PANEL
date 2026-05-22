#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const VERSION = 'v035';
const scriptPath = resolve(process.cwd(), 'scripts/db-business-promotion-write-gate.mjs');
const TARGET_TABLES = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const FORBIDDEN_TABLES = [
  'crm_users',
  'sellers',
  'crm_followups',
  'import_batches',
  'import_raw_rows',
  'migration_plans',
  'migration_plan_events',
  'audit_log'
];

const checks = {
  mainScriptExists: existsSync(scriptPath)
};

if (!checks.mainScriptExists) {
  console.log(JSON.stringify({ ok: false, selfCheck: 'failed', version: VERSION, checks }, null, 2));
  process.exit(1);
}

const source = readFileSync(scriptPath, 'utf8');
checks.requiresGateFlag = source.includes("ADEIN_DB_WRITES_ENABLED === 'true'");
checks.requiresGateScope = source.includes("ADEIN_DB_WRITE_SCOPE") && source.includes('business_promotion');
checks.requiresGateConfirm = source.includes('ADEIN_CONFIRM_BUSINESS_PROMOTION_WRITE') &&
  source.includes('YES_I_UNDERSTAND_BUSINESS_TABLES_ONLY');
checks.noExplicitDbConnection = !source.includes('createDbConnection') && !source.includes('loadDbConfig');
checks.noExplicitLegacyDbNames = !source.includes('adein.crm.v1') && !source.includes('adein.imports.v1');

const run = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8', env: { ...process.env } });
checks.defaultExecutionExitCode = run.status === 0;

let payload = null;
try {
  payload = JSON.parse(run.stdout || '{}');
  checks.outputIsJson = true;
} catch {
  checks.outputIsJson = false;
}

checks.okTrue = payload?.ok === true;
checks.modeDryRun = payload?.mode === 'dry_run';
checks.writesEnabledFalse = payload?.writesEnabled === false;
checks.wouldInsertExists = payload?.wouldInsert && typeof payload.wouldInsert === 'object';

const wouldInsertKeys = checks.wouldInsertExists ? Object.keys(payload.wouldInsert).sort() : [];
checks.wouldInsertExactTargets = JSON.stringify(wouldInsertKeys) === JSON.stringify([...TARGET_TABLES].sort());
checks.wouldInsertHasCounts = TARGET_TABLES.every((table) => typeof payload?.wouldInsert?.[table]?.count === 'number');
checks.noForbiddenTablesInWouldInsert = !wouldInsertKeys.some((table) => FORBIDDEN_TABLES.includes(table));
checks.noCredentialsRequiredInDryRun = !((run.stderr || '').includes('Missing required environment variables'));
checks.noDbWritesExecuted = payload?.safetyChecks?.noDatabaseWritesExecuted === true;

const ok = Object.values(checks).every(Boolean);

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
