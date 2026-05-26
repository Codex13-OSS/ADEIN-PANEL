#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const mainScript = 'scripts/crm-prospect-staging-schema-apply-v064.mjs';
const requiredTables = ['lead_sources', 'prospects', 'whatsapp_conversations', 'whatsapp_analyses', 'prospect_followups', 'crm_history_events'];

function fail(message) {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: 'v064', mode: 'self_check', message }, null, 2)}\n`);
  process.exit(1);
}

const dry = spawnSync(process.execPath, [mainScript], { encoding: 'utf8', env: { ...process.env } });
if (dry.status !== 0) fail('Dry-run default falló');

let payload;
try { payload = JSON.parse(dry.stdout); } catch { fail('Salida dry-run no es JSON válido'); }

const contractKeys = ['ok', 'phase', 'mode', 'dryRun', 'databaseConnectionAttempted', 'schemaFile', 'allowedTables', 'detectedTables', 'forbiddenPatternsDetected', 'applyPlan', 'verificationPlan', 'rollbackNotes', 'safetyEnvelope'];
for (const key of contractKeys) if (!(key in payload)) fail(`Falta key en contrato JSON: ${key}`);

if (payload.phase !== 'v064') fail('phase inválido');
if (payload.mode !== 'dry_run') fail('mode default inválido');
if (payload.dryRun !== true) fail('dryRun default inválido');
if (payload.databaseConnectionAttempted !== false) fail('databaseConnectionAttempted debe ser false en dry-run');
if (payload.ok !== true) fail('ok default debe ser true');
for (const table of requiredTables) if (!payload.allowedTables.includes(table) || !payload.detectedTables.includes(table)) fail(`Tabla esperada faltante: ${table}`);
if ((payload.forbiddenPatternsDetected || []).length !== 0) fail('No deben existir forbidden patterns en v063');

const dangerous = spawnSync(process.execPath, [mainScript], {
  encoding: 'utf8',
  env: { ...process.env, ADEIN_CRM_PROSPECT_STAGING_SCHEMA_APPLY_V064: '1', ADEIN_DB_TARGET: 'production' }
});
if (dangerous.status === 0) fail('Debe rechazar entorno peligroso (production)');

const noGates = spawnSync(process.execPath, [mainScript], {
  encoding: 'utf8',
  env: { ...process.env, ADEIN_CRM_PROSPECT_STAGING_SCHEMA_APPLY_V064: '1', ADEIN_DB_TARGET: 'staging' }
});
if (noGates.status === 0) fail('Apply no debe correr sin ADEIN_DB_ENV_FILE');

const source = fs.readFileSync(mainScript, 'utf8');
if (!source.includes('if (!applyEnabled)')) fail('No se detecta guard de dry-run por defecto');
if (!source.includes('databaseConnectionAttempted = true')) fail('No se detecta control de intento de conexión en apply');

process.stdout.write(`${JSON.stringify({ ok: true, phase: 'v064', mode: 'self_check', checksPassed: true }, null, 2)}\n`);
