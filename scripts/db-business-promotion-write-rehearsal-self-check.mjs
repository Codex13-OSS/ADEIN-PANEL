#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const scriptPath = resolve(process.cwd(), 'scripts/db-business-promotion-write-rehearsal.mjs');
const expectedOrder = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];

const run = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8', env: { ...process.env } });
const failures = [];
const assertions = {};
let payload;

try {
  payload = JSON.parse(run.stdout || '{}');
  assertions.jsonParseable = true;
} catch {
  assertions.jsonParseable = false;
  failures.push('Output is not JSON parseable');
}

assertions.exitZero = run.status === 0;
if (!assertions.exitZero) failures.push(`Script exited with code ${run.status}`);

if (assertions.jsonParseable) {
  assertions.okTrue = payload.ok === true;
  assertions.phaseV037 = payload.phase === 'v037';
  assertions.defaultDryRun = payload.mode === 'dry_run';
  assertions.defaultNoDb = payload.databaseMode === 'none';
  assertions.writesDisabled = payload.writesEnabled === false;
  assertions.commitNotAllowed = payload.commitAllowed === false;
  assertions.outOfScopePresent = Array.isArray(payload.outOfScopeTables) && payload.outOfScopeTables.length > 0;
  assertions.allowedOnly = Array.isArray(payload.orderedSteps) && payload.orderedSteps.every((s) => expectedOrder.includes(s.table));
  assertions.correctOrder = JSON.stringify(payload.orderedSteps.map((s) => s.table)) === JSON.stringify(expectedOrder);

  const rel = payload.relationshipChecks || [];
  assertions.relationshipsValidated = ['property->client', 'lot->property', 'contract->client', 'contract->lot', 'payment_schedule->contract']
    .every((name) => rel.some((r) => r.relation === name && r.ok === true));

  assertions.invalidScenarioBlockers = typeof payload?.summary?.invalidScenarioBlockers === 'number' && payload.summary.invalidScenarioBlockers > 0;
  assertions.noLegacyDbNames = !JSON.stringify(payload).includes('adein.crm.v1') && !JSON.stringify(payload).includes('adein.imports.v1');
  assertions.noFrontendDependency = !JSON.stringify(payload).toLowerCase().includes('frontend');

  const dbAttempt = spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    env: { ...process.env, ADEIN_BP_REHEARSAL_DB_MODE: 'rollback_only' }
  });
  const dbPayload = JSON.parse(dbAttempt.stdout || '{}');
  assertions.dbModeRejectedWithoutGates = dbPayload.mode === 'dry_run' && dbPayload.databaseMode === 'none';

  Object.entries(assertions).forEach(([k, v]) => {
    if (!v) failures.push(`assertion_failed:${k}`);
  });
}

const ok = failures.length === 0;
if (!ok) process.exitCode = 1;
console.log(JSON.stringify({ ok, phase: 'v037', selfCheck: 'db_business_promotion_write_rehearsal', assertions, failures }, null, 2));
