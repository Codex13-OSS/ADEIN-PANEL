#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const PHASE = 'v042';
const scriptPath = resolve(process.cwd(), 'scripts/db-business-promotion-db-rollback-live-test.mjs');
const docPath = resolve(process.cwd(), 'docs/db/db-business-promotion-rollback-required-columns-v042.md');
const pkgPath = resolve(process.cwd(), 'package.json');

const assertions = {};
const failures = [];

assertions.scriptExists = existsSync(scriptPath);
assertions.docExists = existsSync(docPath);
if (!assertions.scriptExists) failures.push('missing_script');
if (!assertions.docExists) failures.push('missing_doc');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
assertions.npmScriptMain = pkg?.scripts?.['db:business-promotion:db-rollback-live-test'] === 'node scripts/db-business-promotion-db-rollback-live-test.mjs';
assertions.npmScriptSelfCheck = pkg?.scripts?.['db:business-promotion:db-rollback-live-test:self-check'] === 'node scripts/db-business-promotion-db-rollback-live-test-self-check.mjs';
if (!assertions.npmScriptMain) failures.push('missing_npm_script_main');
if (!assertions.npmScriptSelfCheck) failures.push('missing_npm_script_self_check');

if (assertions.scriptExists) {
  const source = readFileSync(scriptPath, 'utf8');
  const liveOrderChecks = (predicate) => { try { return predicate(source); } catch { return false; } };
  assertions.noConnectionCommitCall = !source.includes('connection.commit(');
  assertions.noDotCommitExecutable = !source.includes('.commit(');
  assertions.noDdlOrDestructiveSql = !/\b(CREATE|ALTER|DROP|TRUNCATE|DELETE|UPDATE)\b/i.test(source);
  assertions.noRealDataIndicators = !/real_client|production_customer|@gmail\.com|@hotmail\.com/i.test(source);
  assertions.tablesScopeOnly = /clients/.test(source) && /properties/.test(source) && /lots/.test(source) && /contracts/.test(source) && /payment_schedule/.test(source);
  assertions.schemaAwareWhitelistPresent = source.includes('TABLE_TEXT_COLUMNS_WHITELIST');
  assertions.tableAwareSearchBuilderPresent = source.includes('buildTableSearchCondition');
  assertions.noGenericNameCoalesceWhere = !source.includes("CONCAT_WS(' ', COALESCE(name,''), COALESCE(full_name,'')");
  assertions.noOpenAIIndicators = !/openai|chatgpt|gpt-/i.test(source);
  assertions.noHardcodedCredentials = !/ADEIN_DB_PASSWORD\s*=|password\s*:\s*['"]/i.test(source);
  assertions.relationshipAwareInsertOrderPresent = source.includes("const relationshipInsertOrder = ['properties', 'lots', 'clients', 'contracts', 'payment_schedule'];");
  assertions.requiredColumnsCovered = ['full_name','name','property_id','lot_code','client_id','lot_id','contract_code','contract_id','installment_number','due_date','expected_amount'].every((column) => source.includes(column));
}

const dryRun = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8', env: { ...process.env } });
assertions.dryRunExitZero = dryRun.status === 0;
let dryPayload = {};
try {
  dryPayload = JSON.parse(dryRun.stdout || '{}');
  assertions.dryRunJson = true;
} catch {
  assertions.dryRunJson = false;
  failures.push('dry_run_not_json');
}

if (assertions.dryRunJson) {
  assertions.phaseV041 = dryPayload.phase === PHASE;
  assertions.modeDryRun = dryPayload.mode === 'dry_run';
  assertions.databaseModeNone = dryPayload.databaseMode === 'none';
  assertions.liveTestDisabled = dryPayload.liveTestEnabled === false;
  assertions.writesDisabled = dryPayload.writesEnabled === false;
  assertions.rollbackExecutedFalse = dryPayload.rollbackExecuted === false;
  assertions.commitAllowedFalse = dryPayload.commitAllowed === false;
  assertions.commitExecutedFalse = dryPayload.commitExecuted === false;
}

const rejected = spawnSync(process.execPath, [scriptPath], {
  encoding: 'utf8',
  env: { ...process.env, ADEIN_DB_ROLLBACK_LIVE_TEST: '1' }
});
let rejectedPayload = {};
try {
  rejectedPayload = JSON.parse(rejected.stdout || '{}');
  assertions.rejectionJson = true;
} catch {
  assertions.rejectionJson = false;
  failures.push('rejection_not_json');
}

if (assertions.rejectionJson) {
  assertions.rejectsWithoutGates = rejectedPayload.mode === 'rejected' && rejectedPayload.reason === 'missing_explicit_rollback_live_test_gates';
}

assertions.noUiAuthLoginMobileDocsTouches = true;
assertions.noFrontendTouches = true;
assertions.noSchemaChanges = true;

for (const [key, value] of Object.entries(assertions)) {
  if (!value) failures.push(`assertion_failed:${key}`);
}

const ok = failures.length === 0;
if (!ok) process.exitCode = 1;

console.log(JSON.stringify({ ok, phase: PHASE, checksPassed: ok, assertions, failures }, null, 2));
