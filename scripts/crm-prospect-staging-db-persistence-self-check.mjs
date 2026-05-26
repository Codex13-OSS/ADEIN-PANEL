#!/usr/bin/env node
import fs from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const dryRunScript = resolve(process.cwd(), 'scripts/crm-prospect-staging-db-persistence-dry-run.mjs');
const fixturePath = resolve(process.cwd(), 'scripts/fixtures/crm-prospect-staging-demo-v063.json');
const proposalSqlPath = resolve(process.cwd(), 'docs/db/003_crm_prospect_staging_schema_v063.sql');
const packagePath = resolve(process.cwd(), 'package.json');
const requiredTables = ['lead_sources', 'prospects', 'whatsapp_conversations', 'whatsapp_analyses', 'prospect_followups', 'crm_history_events'];

const checks = {};
checks.fixtureExists = fs.existsSync(fixturePath);
checks.proposalSqlExists = fs.existsSync(proposalSqlPath);
checks.dryRunScriptExists = fs.existsSync(dryRunScript);

const run = spawnSync(process.execPath, [dryRunScript], { encoding: 'utf8' });
checks.dryRunExitCodeZero = run.status === 0;

let payload = null;
try {
  payload = JSON.parse(run.stdout || '{}');
  checks.dryRunJsonParseable = true;
} catch {
  checks.dryRunJsonParseable = false;
}

checks.okTrue = payload?.ok === true;
checks.modeDryRun = payload?.mode === 'dry_run';
checks.noDbConnectionRequired = payload?.databaseConnectionRequired === false;
checks.noPersistentWrite = payload?.persistentWriteExecuted === false;
checks.noCommit = payload?.commitExecuted === false;
checks.hasInsertOrder = JSON.stringify(payload?.proposedInsertOrder || []) === JSON.stringify(requiredTables);
checks.hasTables = requiredTables.every((table) => payload?.proposedTables?.includes(table));
checks.excludesFormalClientTables = !JSON.stringify(payload?.candidateRows || {}).match(/"(clients|contracts|payment_schedule|lots)"\s*:/i);

const proposalSql = checks.proposalSqlExists ? fs.readFileSync(proposalSqlPath, 'utf8') : '';
checks.tablesInSql = requiredTables.every((table) => new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${table}`, 'i').test(proposalSql));

const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
checks.packageScriptsPresent = Boolean(packageJson?.scripts?.['crm:prospect-staging:dry-run']) && Boolean(packageJson?.scripts?.['crm:prospect-staging:self-check']);

const dangerousPattern = /\b(?:INSERT|UPDATE|DELETE|COMMIT)\b(?![^\n]*documental|[^\n]*plan)/i;
checks.selfCheckHasNoDangerousExec = !dangerousPattern.test(fs.readFileSync(resolve(process.cwd(), 'scripts/crm-prospect-staging-db-persistence-self-check.mjs'), 'utf8'));
checks.dryRunHasNoDbConnection = !/mysql2|createConnection/i.test(fs.readFileSync(dryRunScript, 'utf8'));

const ok = Object.values(checks).every(Boolean);

console.log(JSON.stringify({ ok, mode: 'dry_run', checks }, null, 2));
if (!ok) process.exit(1);
