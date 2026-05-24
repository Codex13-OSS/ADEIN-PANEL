#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const PHASE = 'v047';
const MODE = 'server_side_readonly_preflight_verification';
const scriptPath = resolve(process.cwd(), 'scripts/db-controlled-write-preflight-readonly-verification.mjs');

const expectedScope = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const expectedBlocked = ['crm_users', 'sellers', 'crm_followups', 'import_batches', 'import_raw_rows', 'migration_plans', 'migration_plan_events', 'audit_log'];

function runScript(extraEnv = {}) {
  return spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv }
  });
}

function assertBool(assertions, failures, key, condition) {
  assertions[key] = Boolean(condition);
  if (!condition) failures.push(`assertion_failed:${key}`);
}

const assertions = {};
const failures = [];

const mainRun = runScript();
assertBool(assertions, failures, 'mainExitCodeZero', mainRun.status === 0);

let payload = null;
try {
  payload = JSON.parse(mainRun.stdout || '{}');
  assertions.mainJsonParseable = true;
} catch {
  assertions.mainJsonParseable = false;
  failures.push('assertion_failed:mainJsonParseable');
}

if (assertions.mainJsonParseable) {
  assertBool(assertions, failures, 'okTrue', payload.ok === true);
  assertBool(assertions, failures, 'phaseV047', payload.phase === PHASE);
  assertBool(assertions, failures, 'modeServerSideReadonlyPreflightVerification', payload.mode === MODE);
  assertBool(assertions, failures, 'dryRunTrue', payload.dryRun === true);
  assertBool(assertions, failures, 'readOnlyTrue', payload.readOnly === true);
  assertBool(assertions, failures, 'commitAllowedFalse', payload.commitAllowed === false);
  assertBool(assertions, failures, 'commitExecutedFalse', payload.commitExecuted === false);
  assertBool(assertions, failures, 'persistentWriteExecutedFalse', payload.persistentWriteExecuted === false);
  assertBool(assertions, failures, 'realWriteAuthorizedFalse', payload.realWriteAuthorized === false);
  assertBool(assertions, failures, 'backupVerificationRequiredTrue', payload.backupVerificationRequired === true);
  assertBool(assertions, failures, 'snapshotBeforeRequiredTrue', payload.snapshotBeforeRequired === true);
  assertBool(assertions, failures, 'snapshotAfterRequiredTrue', payload.snapshotAfterRequired === true);
  assertBool(assertions, failures, 'humanApprovalRequiredTrue', payload.humanApprovalRequired === true);
  assertBool(assertions, failures, 'approvalArtifactRequiredTrue', payload.approvalArtifactRequired === true);
  assertBool(assertions, failures, 'tablesInScopeExact', JSON.stringify(payload.tablesInScope || []) === JSON.stringify(expectedScope));
  assertBool(assertions, failures, 'tablesBlockedIncludesAll', expectedBlocked.every((table) => (payload.tablesBlocked || []).includes(table)));
  assertBool(assertions, failures, 'readOnlyChecksExist', Array.isArray(payload.readOnlyChecks) && payload.readOnlyChecks.length > 0);

  const criticalChecks = (payload.readOnlyChecks || []).filter((check) => check?.critical === true);
  assertBool(assertions, failures, 'criticalReadOnlyChecksPass', criticalChecks.length > 0 && criticalChecks.every((check) => check.ok === true));
  assertBool(assertions, failures, 'nextRecommendedPhasePresent', typeof payload.nextRecommendedPhase === 'string' && payload.nextRecommendedPhase.length > 0);
}

const negativeCases = [
  { name: 'ADEIN_DB_COMMIT=1', env: { ADEIN_DB_COMMIT: '1' } },
  { name: 'ADEIN_DB_WRITE_GATE=REAL_COMMIT', env: { ADEIN_DB_WRITE_GATE: 'REAL_COMMIT' } },
  { name: 'ADEIN_DB_ALLOW_PERSISTENT_WRITE=1', env: { ADEIN_DB_ALLOW_PERSISTENT_WRITE: '1' } },
  { name: 'ADEIN_DB_ENABLE_WRITES=1', env: { ADEIN_DB_ENABLE_WRITES: '1' } },
  { name: 'ADEIN_DB_MODE=write', env: { ADEIN_DB_MODE: 'write' } },
  { name: 'ADEIN_DB_MODE=read_write', env: { ADEIN_DB_MODE: 'read_write' } }
];

const negativeResults = negativeCases.map((testCase) => {
  const result = runScript(testCase.env);
  let parsed;
  let jsonParseable = false;

  try {
    parsed = JSON.parse(result.stdout || '{}');
    jsonParseable = true;
  } catch {
    failures.push(`negative_not_json:${testCase.name}`);
  }

  const rejected = result.status === 1
    && jsonParseable
    && parsed?.ok === false
    && parsed?.mode === 'blocked_dangerous_write_gate';

  if (!rejected) {
    failures.push(`negative_not_rejected:${testCase.name}`);
  }

  return {
    case: testCase.name,
    exitCode: result.status,
    rejected,
    jsonParseable
  };
});

const ok = failures.length === 0;
if (!ok) process.exitCode = 1;

console.log(JSON.stringify({
  ok,
  phase: PHASE,
  selfCheck: 'db-controlled-write-preflight-readonly-verification',
  assertions,
  negativeResults,
  failures
}, null, 2));
