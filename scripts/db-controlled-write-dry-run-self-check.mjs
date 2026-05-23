#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const PHASE = 'v045';
const scriptPath = resolve(process.cwd(), 'scripts/db-controlled-write-dry-run.mjs');
const expectedScope = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const expectedBlocked = ['crm_users', 'sellers', 'crm_followups', 'import_batches', 'import_raw_rows', 'migration_plans', 'migration_plan_events', 'audit_log'];

function runScript(extraEnv = {}) {
  return spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv }
  });
}

const failures = [];
const assertions = {};

const regularRun = runScript();
assertions.mainExitCodeZero = regularRun.status === 0;
if (!assertions.mainExitCodeZero) failures.push(`main_exit_code_${regularRun.status}`);

let payload;
try {
  payload = JSON.parse(regularRun.stdout || '{}');
  assertions.jsonParseable = true;
} catch {
  assertions.jsonParseable = false;
  failures.push('main_output_not_json');
}

if (assertions.jsonParseable) {
  assertions.okTrue = payload.ok === true;
  assertions.phaseV045 = payload.phase === PHASE;
  assertions.dryRunTrue = payload.dryRun === true;
  assertions.commitAllowedFalse = payload.commitAllowed === false;
  assertions.commitExecutedFalse = payload.commitExecuted === false;
  assertions.persistentWriteExecutedFalse = payload.persistentWriteExecuted === false;
  assertions.approvalRequiredTrue = payload.approvalRequiredBeforeRealWrite === true;

  assertions.tablesInScopeExact = JSON.stringify(payload.tablesInScope || []) === JSON.stringify(expectedScope);
  assertions.tablesBlockedIncludesAll = expectedBlocked.every((table) => (payload.tablesBlocked || []).includes(table));
  assertions.relationshipOrderExists = !!payload.relationshipOrder;
  assertions.relationshipOrderOk = payload.relationshipOrder?.ok === true;
  assertions.requiredColumnsCheckOk = payload.requiredColumnsCheck?.ok === true;

  Object.entries(assertions).forEach(([key, value]) => {
    if (!value) failures.push(`assertion_failed:${key}`);
  });
}

const negativeRun = runScript({ ADEIN_DB_COMMIT: '1' });
assertions.negativeExitCodeIsOne = negativeRun.status === 1;
if (!assertions.negativeExitCodeIsOne) failures.push(`negative_exit_code_${negativeRun.status}`);

let negativePayload;
try {
  negativePayload = JSON.parse(negativeRun.stdout || '{}');
  assertions.negativeJsonParseable = true;
} catch {
  assertions.negativeJsonParseable = false;
  failures.push('negative_output_not_json');
}

if (assertions.negativeJsonParseable) {
  assertions.negativeRejected = negativePayload.ok === false && negativePayload.commitAllowed === false && negativePayload.commitExecuted === false && negativePayload.persistentWriteExecuted === false;
  if (!assertions.negativeRejected) failures.push('negative_commit_not_rejected');
}

const ok = failures.length === 0;
if (!ok) process.exitCode = 1;

console.log(JSON.stringify({
  ok,
  phase: PHASE,
  selfCheck: 'db-controlled-write-dry-run',
  assertions,
  failures
}, null, 2));
