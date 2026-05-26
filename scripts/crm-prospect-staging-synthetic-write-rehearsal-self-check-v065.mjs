#!/usr/bin/env node
import fs from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const mainScript = resolve(process.cwd(), 'scripts/crm-prospect-staging-synthetic-write-rehearsal-v065.mjs');

function fail(message) {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: 'v065', mode: 'self_check', message }, null, 2)}\n`);
  process.exit(1);
}

const dry = spawnSync(process.execPath, [mainScript], { encoding: 'utf8', env: { ...process.env } });
if (dry.status !== 0) fail('Dry-run default falló');

let payload;
try { payload = JSON.parse(dry.stdout); } catch { fail('Salida dry-run no es JSON válido'); }

const requiredKeys = [
  'ok', 'phase', 'mode', 'dryRun', 'databaseConnectionAttempted', 'transactionStarted', 'rollbackExecuted',
  'commitExecuted', 'persistentWriteExecuted', 'syntheticOnly', 'targetTables', 'syntheticPayloadPreview',
  'insertionPlan', 'verificationPlan', 'safetyEnvelope'
];
for (const k of requiredKeys) if (!(k in payload)) fail(`Falta key crítica en contrato JSON: ${k}`);

if (payload.phase !== 'v065') fail('phase inválido');
if (payload.mode !== 'dry_run') fail('mode default inválido');
if (payload.dryRun !== true) fail('dryRun default inválido');
if (payload.databaseConnectionAttempted !== false) fail('databaseConnectionAttempted debe ser false en dry-run');
if (payload.commitExecuted !== false) fail('commitExecuted debe ser false');
if (payload.persistentWriteExecuted !== false) fail('persistentWriteExecuted debe ser false');
if (payload.syntheticOnly !== true) fail('syntheticOnly debe ser true');

const dangerous = spawnSync(process.execPath, [mainScript], {
  encoding: 'utf8',
  env: { ...process.env, NODE_ENV: 'production' }
});
if (dangerous.status === 0) fail('Debe rechazar entorno peligroso');

const missingGates = spawnSync(process.execPath, [mainScript], {
  encoding: 'utf8',
  env: { ...process.env, ADEIN_CRM_PROSPECT_STAGING_SYNTHETIC_WRITE_V065: '1', ADEIN_DB_TARGET: 'staging', ADEIN_DB_WRITE_GATE: 'ROLLBACK_ONLY_V065' }
});
if (missingGates.status === 0) fail('No debe correr rollback-only sin ADEIN_DB_ENV_FILE');

const source = fs.readFileSync(mainScript, 'utf8');
if (/\bcommit\s*\(/i.test(source) || /\bCOMMIT\b/i.test(source)) fail('Se detectó patrón de COMMIT ejecutable');
if (/(INSERT|UPDATE|DELETE)\s+INTO\s+`?(clients|contracts|payment_schedule|lots)`?/i.test(source)) fail('Destino prohibido detectado en script');

process.stdout.write(`${JSON.stringify({ ok: true, phase: 'v065', mode: 'self_check', checksPassed: true }, null, 2)}\n`);
