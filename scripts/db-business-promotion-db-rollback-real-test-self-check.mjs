#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const PHASE = 'v041';
const scriptPath = resolve(process.cwd(), 'scripts/db-business-promotion-db-rollback-real-test.mjs');
const liveScriptPath = resolve(process.cwd(), 'scripts/db-business-promotion-db-rollback-live-test.mjs');
const docPath = resolve(process.cwd(), 'docs/db/db-business-promotion-db-rollback-schema-aware-v041.md');
const pkgPath = resolve(process.cwd(), 'package.json');

const assertions = {};
const failures = [];

assertions.scriptExists = existsSync(scriptPath);
assertions.liveScriptExists = existsSync(liveScriptPath);
assertions.docExists = existsSync(docPath);
if (!assertions.scriptExists) failures.push('missing_script');
if (!assertions.docExists) failures.push('missing_doc');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
assertions.npmScriptMain = pkg?.scripts?.['db:business-promotion:db-rollback-real-test'] === 'node scripts/db-business-promotion-db-rollback-real-test.mjs';
assertions.npmScriptSelfCheck = pkg?.scripts?.['db:business-promotion:db-rollback-real-test:self-check'] === 'node scripts/db-business-promotion-db-rollback-real-test-self-check.mjs';
if (!assertions.npmScriptMain) failures.push('missing_npm_script_main');
if (!assertions.npmScriptSelfCheck) failures.push('missing_npm_script_self_check');

if (assertions.scriptExists) {
  const source = readFileSync(scriptPath, 'utf8');
  assertions.noCommitCall = !source.includes('.commit(');
  assertions.noHardcodedCredentials = !/ADEIN_DB_PASSWORD\s*=|password\s*:\s*['"]/i.test(source);
  assertions.noOpenAIIndicators = !/openai|chatgpt|gpt-/i.test(source);
}


if (assertions.liveScriptExists) {
  const liveSource = readFileSync(liveScriptPath, 'utf8');
  assertions.schemaAwareWhitelistPresent = liveSource.includes('TABLE_TEXT_COLUMNS_WHITELIST');
  assertions.noGenericNameCoalesceWhere = !liveSource.includes("CONCAT_WS(' ', COALESCE(name,''), COALESCE(full_name,'')");
  assertions.tableAwareSearchBuilderPresent = liveSource.includes('buildTableSearchCondition');
  assertions.noLiveCommitCall = !liveSource.includes('.commit(');
  assertions.noLiveOpenAIIndicators = !/openai|chatgpt|gpt-/i.test(liveSource);
  assertions.noLiveHardcodedCredentials = !/ADEIN_DB_PASSWORD\s*=|password\s*:\s*['"]/i.test(liveSource);
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
  assertions.phaseIsV041 = dryPayload.phase === PHASE;
  assertions.modeDryRun = dryPayload.mode === 'dry_run';
  assertions.commitAllowedFalse = dryPayload.commitAllowed === false;
  assertions.commitExecutedFalse = dryPayload.commitExecuted === false;
  assertions.rollbackExecutedFalse = dryPayload.rollbackExecuted === false;
}

for (const [key, value] of Object.entries(assertions)) {
  if (!value) failures.push(`assertion_failed:${key}`);
}

const ok = failures.length === 0;
if (!ok) process.exitCode = 1;

console.log(JSON.stringify({ ok, phase: PHASE, checksPassed: ok, assertions, failures }, null, 2));
