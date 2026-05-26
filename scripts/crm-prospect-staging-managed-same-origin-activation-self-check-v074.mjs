#!/usr/bin/env node
import fs from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const PHASE = 'v074';
const fail = (message) => {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: PHASE, mode: 'self_check', message }, null, 2)}\n`);
  process.exit(1);
};

const activationFile = resolve(process.cwd(), 'scripts/crm-prospect-staging-managed-same-origin-activation-v074.mjs');
const srcRoot = resolve(process.cwd(), 'src');
const srcFrontend = resolve(process.cwd(), 'src/frontend');
const packageJsonFile = resolve(process.cwd(), 'package.json');
const dependencies = [
  resolve(process.cwd(), 'scripts/crm-prospect-staging-readonly-api-bridge-self-check-v069.mjs'),
  resolve(process.cwd(), 'scripts/crm-prospect-staging-dashboard-api-consumption-self-check-v070.mjs'),
  resolve(process.cwd(), 'scripts/crm-prospect-staging-same-origin-readonly-snapshot-self-check-v071.mjs'),
  resolve(process.cwd(), 'scripts/crm-prospect-staging-same-origin-readonly-process-cleanup-self-check-v072.mjs'),
  resolve(process.cwd(), 'scripts/crm-prospect-staging-managed-same-origin-bridge-self-check-v073.mjs')
];

const source = fs.readFileSync(activationFile, 'utf8');
if (/\bpm2\s+(restart|delete|stop|start)\b/i.test(source)) fail('Script v074 contiene comando pm2 destructivo');
if (/ADEIN_SAME_ORIGIN_PORT\s*\|\|\s*3006|:3006\/health|127\.0\.0\.1:3006/.test(source)) fail('Script v074 intenta operar sobre 3006');

const frontendFiles = [
  resolve(process.cwd(), 'src/pages/OwnerDashboardPage.tsx'),
  resolve(process.cwd(), 'src/lib/crmProspectStagingReadonlyApiClient.ts'),
  resolve(process.cwd(), 'src/lib/crmProspectStagingReadonlySnapshot.ts')
].filter((f) => fs.existsSync(f));
const dbKeywordCheck = spawnSync('rg', ['-n', 'mysql|mysql2|mariadb', ...frontendFiles], { encoding: 'utf8' });
if (dbKeywordCheck.status === 0 && dbKeywordCheck.stdout.trim()) fail('mysql/mysql2/mariadb detectado en frontend src');

if (fs.existsSync(srcFrontend)) {
  const hardcodeFrontend = spawnSync('rg', ['-n', '127\\.0\\.0\\.1:3091', srcFrontend], { encoding: 'utf8' });
  if (hardcodeFrontend.status === 0 && hardcodeFrontend.stdout.trim()) fail('Hardcode frontend 127.0.0.1:3091 detectado');
}

const pkg = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
if (!pkg?.scripts?.['crm:prospect-staging:managed-same-origin-activation']) fail('Falta script npm v074 activation');
if (!pkg?.scripts?.['crm:prospect-staging:managed-same-origin-activation:self-check']) fail('Falta script npm v074 self-check');

const dryRun = spawnSync(process.execPath, [activationFile], { encoding: 'utf8', env: { ...process.env } });
if (dryRun.status !== 0) fail(`Default dry-run falló: ${dryRun.stderr || dryRun.stdout}`);
let payload = null;
try { payload = JSON.parse(dryRun.stdout.trim()); } catch { fail('Default dry-run no devolvió JSON válido'); }

if (payload.mode !== 'activation_preflight_dry_run') fail('Default mode no es dry-run');
for (const k of ['productionTouched', 'stagingPm2Touched', 'writeExecuted', 'commitExecuted', 'transactionStarted', 'activationExecuted']) {
  if (payload[k] !== false) fail(`Flag ${k} debe ser false`);
}

const rehearsal = spawnSync(process.execPath, [activationFile], {
  encoding: 'utf8',
  env: { ...process.env, ADEIN_CRM_PROSPECT_STAGING_MANAGED_SAME_ORIGIN_ACTIVATION_V074: '1', ADEIN_V074_MODE: 'rehearsal' }
});
if (rehearsal.status !== 0) fail(`Rehearsal v074 falló: ${rehearsal.stderr || rehearsal.stdout}`);
let rehearsalPayload = null;
try { rehearsalPayload = JSON.parse(rehearsal.stdout.trim()); } catch { fail('Rehearsal v074 no devolvió JSON válido'); }
if (rehearsalPayload?.cleanup?.lingeringProcesses !== false) fail('Rehearsal no limpió procesos temporales');

for (const dep of dependencies) {
  const run = spawnSync(process.execPath, [dep], { encoding: 'utf8', env: { ...process.env } });
  if (run.status !== 0) fail(`Dependencia falló: ${dep}`);
}

process.stdout.write(`${JSON.stringify({ ok: true, phase: PHASE, mode: 'self_check', checksPassed: true }, null, 2)}\n`);
