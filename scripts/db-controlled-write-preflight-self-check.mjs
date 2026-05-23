#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const PHASE = 'v046';
const MODE = 'preflight_dry_run';
const scriptPath = resolve(process.cwd(), 'scripts/db-controlled-write-preflight.mjs');

const expectedScope = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const expectedBlocked = ['crm_users', 'sellers', 'crm_followups', 'import_batches', 'import_raw_rows', 'migration_plans', 'migration_plan_events', 'audit_log'];

function runScript(extraEnv = {}) {
  return spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv }
  });
}

function pushAssertion(assertions, failures, key, condition, failureTag = key) {
  assertions[key] = Boolean(condition);
  if (!condition) failures.push(`assertion_failed:${failureTag}`);
}

const failures = [];
const assertions = {};

const mainRun = runScript();
pushAssertion(assertions, failures, 'mainExitCodeZero', mainRun.status === 0, `main_exit_code_${mainRun.status}`);

let payload;
try {
  payload = JSON.parse(mainRun.stdout || '{}');
  assertions.mainJsonParseable = true;
} catch {
  assertions.mainJsonParseable = false;
  failures.push('main_output_not_json');
}

if (assertions.mainJsonParseable) {
  pushAssertion(assertions, failures, 'okTrue', payload.ok === true);
  pushAssertion(assertions, failures, 'phaseV046', payload.phase === PHASE);
  pushAssertion(assertions, failures, 'modePreflightDryRun', payload.mode === MODE);
  pushAssertion(assertions, failures, 'dryRunTrue', payload.dryRun === true);
  pushAssertion(assertions, failures, 'commitAllowedFalse', payload.commitAllowed === false);
  pushAssertion(assertions, failures, 'commitExecutedFalse', payload.commitExecuted === false);
  pushAssertion(assertions, failures, 'persistentWriteExecutedFalse', payload.persistentWriteExecuted === false);
  pushAssertion(assertions, failures, 'realWriteAuthorizedFalse', payload.realWriteAuthorized === false);
  pushAssertion(assertions, failures, 'approvalArtifactGeneratedTrue', payload.approvalArtifactGenerated === true);
  pushAssertion(assertions, failures, 'backupVerificationRequiredTrue', payload.backupVerificationRequired === true);
  pushAssertion(assertions, failures, 'backupVerifiedFalse', payload.backupVerified === false);
  pushAssertion(assertions, failures, 'humanApprovalRequiredTrue', payload.humanApprovalRequired === true);
  pushAssertion(assertions, failures, 'requiredHumanApprovalTextPresent', typeof payload.requiredHumanApprovalText === 'string' && payload.requiredHumanApprovalText.trim().length > 0);
  pushAssertion(assertions, failures, 'tablesInScopeExact', JSON.stringify(payload.tablesInScope || []) === JSON.stringify(expectedScope));
  pushAssertion(assertions, failures, 'tablesBlockedIncludesAll', expectedBlocked.every((table) => (payload.tablesBlocked || []).includes(table)));
  pushAssertion(assertions, failures, 'preflightChecksExists', Array.isArray(payload.preflightChecks) && payload.preflightChecks.length > 0);

  const criticalChecks = (payload.preflightChecks || []).filter((check) => check?.critical === true);
  pushAssertion(assertions, failures, 'criticalChecksPass', criticalChecks.length > 0 && criticalChecks.every((check) => check.ok === true));
  pushAssertion(assertions, failures, 'evidenceTemplateExists', !!payload.evidenceTemplate && typeof payload.evidenceTemplate === 'object');
}

const negativeCases = [
  { name: 'ADEIN_DB_COMMIT=1', env: { ADEIN_DB_COMMIT: '1' } },
  { name: 'ADEIN_DB_WRITE_GATE=REAL_COMMIT', env: { ADEIN_DB_WRITE_GATE: 'REAL_COMMIT' } },
  { name: 'ADEIN_DB_ALLOW_PERSISTENT_WRITE=1', env: { ADEIN_DB_ALLOW_PERSISTENT_WRITE: '1' } }
];

const negativeResults = negativeCases.map((testCase) => {
  const result = runScript(testCase.env);
  let parsed = null;
  let jsonParseable = false;

  try {
    parsed = JSON.parse(result.stdout || '{}');
    jsonParseable = true;
  } catch {
    failures.push(`negative_output_not_json:${testCase.name}`);
  }

  const rejected = result.status === 1
    && jsonParseable
    && parsed?.ok === false
    && parsed?.commitAllowed === false
    && parsed?.commitExecuted === false
    && parsed?.persistentWriteExecuted === false;

  if (!rejected) {
    failures.push(`negative_case_not_rejected:${testCase.name}`);
  }

  return {
    case: testCase.name,
    exitCode: result.status,
    rejected,
    jsonParseable
  };
});

assertions.negativeCasesRejected = negativeResults.every((r) => r.rejected === true);
if (!assertions.negativeCasesRejected) {
  failures.push('assertion_failed:negativeCasesRejected');
}

const ok = failures.length === 0;
if (!ok) process.exitCode = 1;

console.log(JSON.stringify({
  ok,
  phase: PHASE,
  selfCheck: 'db-controlled-write-preflight',
  assertions,
  negativeResults,
  failures
}, null, 2));
