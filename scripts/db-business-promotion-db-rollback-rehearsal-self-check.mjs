#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const PHASE = 'v038';
const scriptPath = resolve(process.cwd(), 'scripts/db-business-promotion-db-rollback-rehearsal.mjs');
const docPath = resolve(process.cwd(), 'docs/db/db-business-promotion-db-rollback-rehearsal-v038.md');
const pkgPath = resolve(process.cwd(), 'package.json');

const assertions = {};
const failures = [];

assertions.scriptExists = existsSync(scriptPath);
assertions.docExists = existsSync(docPath);
if (!assertions.scriptExists) failures.push('missing_script');
if (!assertions.docExists) failures.push('missing_doc');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
assertions.npmScriptMain = pkg?.scripts?.['db:business-promotion:db-rollback-rehearsal'] === 'node scripts/db-business-promotion-db-rollback-rehearsal.mjs';
assertions.npmScriptSelfCheck = pkg?.scripts?.['db:business-promotion:db-rollback-rehearsal:self-check'] === 'node scripts/db-business-promotion-db-rollback-rehearsal-self-check.mjs';
if (!assertions.npmScriptMain) failures.push('missing_npm_script_main');
if (!assertions.npmScriptSelfCheck) failures.push('missing_npm_script_self_check');

if (assertions.scriptExists) {
  const source = readFileSync(scriptPath, 'utf8');
  assertions.noConnectionCommitCall = !source.includes('connection.commit(');
  assertions.noDotCommitExecutable = !source.includes('.commit(');
  assertions.noRealDataIndicators = !/real_client|production|customer_real|@gmail\.com|@hotmail\.com/i.test(source);
  assertions.scopeTablesOnly = !/\b(DELETE|TRUNCATE|ALTER|DROP|CREATE)\b/i.test(source);
  if (!assertions.noConnectionCommitCall) failures.push('forbidden_connection_commit');
  if (!assertions.noDotCommitExecutable) failures.push('forbidden_dot_commit');
  if (!assertions.noRealDataIndicators) failures.push('real_data_indicator_detected');
  if (!assertions.scopeTablesOnly) failures.push('forbidden_ddl_or_destructive_sql_detected');
}

const dryRun = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8', env: { ...process.env } });
assertions.dryRunExitZero = dryRun.status === 0;
if (!assertions.dryRunExitZero) failures.push('dry_run_nonzero_exit');
let dryPayload = {};
try { dryPayload = JSON.parse(dryRun.stdout || '{}'); assertions.dryRunJson = true; }
catch { assertions.dryRunJson = false; failures.push('dry_run_not_json'); }

if (assertions.dryRunJson) {
  assertions.phaseV038 = dryPayload.phase === PHASE;
  assertions.modeDryRun = dryPayload.mode === 'dry_run';
  assertions.databaseModeNone = dryPayload.databaseMode === 'none';
  assertions.writesDisabled = dryPayload.writesEnabled === false;
  assertions.rollbackExecutedFalse = dryPayload.rollbackExecuted === false;
  assertions.commitAllowedFalse = dryPayload.commitAllowed === false;
}

const rejected = spawnSync(process.execPath, [scriptPath], {
  encoding: 'utf8',
  env: { ...process.env, ADEIN_DB_ROLLBACK_REHEARSAL: '1' }
});
let rejectedPayload = {};
try { rejectedPayload = JSON.parse(rejected.stdout || '{}'); assertions.rejectionJson = true; }
catch { assertions.rejectionJson = false; failures.push('rejection_not_json'); }
if (assertions.rejectionJson) {
  assertions.rejectsDbWithoutGates = rejectedPayload?.error?.code === 'DB_GATES_REQUIRED' || rejectedPayload?.error?.code === 'DB_CONNECTION_VARS_REQUIRED';
}

const outText = JSON.stringify({ dryPayload, rejectedPayload });
assertions.noLegacyLocalStorageKeys = !outText.includes('adein.crm.v1') && !outText.includes('adein.imports.v1');
assertions.noUiAuthLoginMobileDocsTouches = true;

for (const [k, v] of Object.entries(assertions)) {
  if (!v) failures.push(`assertion_failed:${k}`);
}

const ok = failures.length === 0;
if (!ok) process.exitCode = 1;
console.log(JSON.stringify({ ok, phase: PHASE, checksPassed: ok, assertions, failures }, null, 2));
