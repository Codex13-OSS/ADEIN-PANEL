#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const VERSION = 'v036';
const SELF_CHECK = 'business_promotion_transaction_preview';
const ALLOWED = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const EXPECTED_ORDER = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];

const scriptPath = resolve(process.cwd(), 'scripts/db-business-promotion-transaction-preview.mjs');
const run = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8', env: { ...process.env } });

const assertions = {
  jsonParseable: false,
  dryRunMode: false,
  writesDisabled: false,
  scopeIsCorrect: false,
  allowedTablesOnly: false,
  insertionOrderValid: false,
  stepsAreScoped: false,
  noDatabaseRequired: false,
  noWriteSignals: false,
  negativeCaseCovered: false
};

const failures = [];
const notes = [];
let payload;

try {
  payload = JSON.parse(run.stdout || '{}');
  assertions.jsonParseable = true;
} catch {
  failures.push('Preview output is not parseable JSON.');
}

if (run.status !== 0) {
  failures.push(`Preview script exited with code ${run.status}.`);
}

if (assertions.jsonParseable) {
  assertions.dryRunMode = payload.mode === 'dry_run';
  assertions.writesDisabled = payload.writesEnabled === false;
  assertions.scopeIsCorrect = payload.scope === SELF_CHECK;
  assertions.allowedTablesOnly =
    Array.isArray(payload.allowedTables) &&
    payload.allowedTables.length === ALLOWED.length &&
    payload.allowedTables.every((table) => ALLOWED.includes(table));
  assertions.insertionOrderValid = JSON.stringify(payload.insertionOrder) === JSON.stringify(EXPECTED_ORDER);
  assertions.stepsAreScoped =
    Array.isArray(payload?.transactionPreview?.steps) &&
    payload.transactionPreview.steps.every((step) => ALLOWED.includes(step.table));

  const serialized = JSON.stringify(payload);
  assertions.noDatabaseRequired = !serialized.includes('mysql') && !serialized.includes('mariadb');
  assertions.noWriteSignals = !serialized.includes('INSERT INTO') && !serialized.includes('writesEnabled":true');
  assertions.negativeCaseCovered =
    Array.isArray(payload.notes) && payload.notes.some((n) => typeof n === 'string' && n.includes('invalidScenarioBlockedSteps='));

  if (payload.ok !== true) failures.push('ok !== true');
  if (payload.version !== VERSION) failures.push('version !== v036');
}

for (const [name, value] of Object.entries(assertions)) {
  if (!value) failures.push(`assertion_failed:${name}`);
}

const ok = failures.length === 0;
if (!ok) process.exitCode = 1;

console.log(JSON.stringify({ ok, version: VERSION, selfCheck: SELF_CHECK, assertions, failures, notes }, null, 2));
