#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { resolve } from 'node:path';

const PHASE = 'v068';
const mainScript = resolve(process.cwd(), 'scripts/crm-prospect-staging-readonly-dashboard-v068.mjs');
const snapshotLib = resolve(process.cwd(), 'src/lib/crmProspectStagingReadonlySnapshot.ts');
const dashboardPage = resolve(process.cwd(), 'src/pages/OwnerDashboardPage.tsx');

const fail = (message) => {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: PHASE, mode: 'self_check', message }, null, 2)}\n`);
  process.exit(1);
};

const run = (env = {}) => spawnSync(process.execPath, [mainScript], { encoding: 'utf8', env: { ...process.env, ...env } });
const parseJson = (text, label) => { try { return JSON.parse(text); } catch { fail(`JSON inválido: ${label}`); } };

const dry = run();
if (dry.status !== 0) fail('dry-run default falló');
const p = parseJson(dry.stdout, 'dry-run');
for (const key of ['ok','phase','mode','dryRun','databaseConnectionAttempted','transactionStarted','writeExecuted','commitExecuted','readonly','productionTouched','targetTables','forbiddenDestinations','dashboardPayloadPreview','readonlyQueryPlan','expectedMetrics','safetyEnvelope']) {
  if (!(key in p)) fail(`Falta key ${key}`);
}
if (p.mode !== 'dry_run' || p.databaseConnectionAttempted !== false || p.readonly !== true || p.writeExecuted !== false || p.commitExecuted !== false || p.productionTouched !== false) {
  fail('Contrato dry-run no cumple');
}

const readonlyNoGates = run({ ADEIN_CRM_PROSPECT_STAGING_READONLY_DASHBOARD_V068: '1', ADEIN_DB_TARGET: 'staging', ADEIN_DB_READONLY_DASHBOARD: '1' });
const noGatePayload = parseJson(readonlyNoGates.stdout, 'readonly-no-gates');
if (readonlyNoGates.status !== 0 || noGatePayload.mode !== 'dry_run' || noGatePayload.databaseConnectionAttempted !== false) fail('No debe ejecutar controlled mode sin gates completos');

if (run({ NODE_ENV: 'production' }).status === 0) fail('Debe abortar con NODE_ENV=production');
if (run({ ADEIN_DB_TARGET: 'production' }).status === 0) fail('Debe abortar con ADEIN_DB_TARGET=production');
if (run({ ADEIN_DB_ENV: 'production' }).status === 0) fail('Debe abortar con ADEIN_DB_ENV=production');
if (run({ ADEIN_DB_COMMIT: '1' }).status === 0) fail('Debe abortar con ADEIN_DB_COMMIT=1');
if (run({ ADEIN_DB_ALLOW_PERSISTENT_WRITE: '1' }).status === 0) fail('Debe abortar con ADEIN_DB_ALLOW_PERSISTENT_WRITE=1');
if (run({ ADEIN_DB_ENABLE_WRITES: '1' }).status === 0) fail('Debe abortar con ADEIN_DB_ENABLE_WRITES=1');
if (run({ ADEIN_DB_WRITE_GATE: 'X' }).status === 0) fail('Debe abortar con ADEIN_DB_WRITE_GATE definido');
if (run({ ADEIN_DB_APPROVAL_TOKEN: 'X' }).status === 0) fail('Debe abortar con ADEIN_DB_APPROVAL_TOKEN definido');

const source = fs.readFileSync(mainScript, 'utf8');
if (/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE|REPLACE)\b/i.test(source.replace(/DANGEROUS_SQL_KEYWORDS[\s\S]*?\];/m, ''))) {
  fail('Detectadas keywords peligrosas fuera de guardas');
}
if (/\b(mysql2|createConnection|ADEIN_DB_PASSWORD|ADEIN_DB_HOST)\b/i.test(fs.readFileSync(snapshotLib, 'utf8'))) fail('lib frontend no debe conectar a BD');
if (/\b(INSERT|UPDATE|DELETE)\s+(INTO\s+)?`?(clients|contracts|payment_schedule|lots)`?/i.test(source)) fail('Destino prohibido detectado');

process.stdout.write(`${JSON.stringify({ ok: true, phase: PHASE, mode: 'self_check', checksPassed: true }, null, 2)}\n`);
