#!/usr/bin/env node
import fs from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const PHASE = 'v066';
const mainScript = resolve(process.cwd(), 'scripts/crm-prospect-staging-synthetic-persistent-write-approval-v066.mjs');

function fail(message) {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: PHASE, mode: 'self_check', message }, null, 2)}\n`);
  process.exit(1);
}

const dry = spawnSync(process.execPath, [mainScript], { encoding: 'utf8', env: { ...process.env } });
if (dry.status !== 0) fail('Default approval evidence falló');

let payload;
try { payload = JSON.parse(dry.stdout); } catch { fail('Salida default no es JSON válido'); }

const requiredKeys = [
  'ok', 'phase', 'mode', 'dryRun', 'databaseConnectionAttempted', 'transactionStarted', 'rollbackExecuted',
  'commitExecuted', 'persistentWriteExecuted', 'syntheticOnly', 'realProspectsUsed', 'productionTouched',
  'targetTables', 'forbiddenDestinations', 'syntheticPayloadPreview', 'proposedPersistentWritePlan',
  'requiredApprovalGatesForFutureCommit', 'requiredPreCommitChecks', 'abortConditions',
  'expectedEvidenceAfterFutureCommit', 'rollbackPlanIfFutureCommitFails', 'safetyEnvelope'
];
for (const k of requiredKeys) if (!(k in payload)) fail(`Falta key crítica en contrato JSON: ${k}`);

if (payload.phase !== PHASE) fail('phase inválido');
if (payload.mode !== 'approval_evidence_only') fail('mode default inválido');
if (payload.dryRun !== true) fail('dryRun default inválido');
if (payload.databaseConnectionAttempted !== false) fail('databaseConnectionAttempted debe ser false por defecto');
if (payload.transactionStarted !== false) fail('transactionStarted debe ser false');
if (payload.commitExecuted !== false) fail('commitExecuted debe ser false');
if (payload.persistentWriteExecuted !== false) fail('persistentWriteExecuted debe ser false');
if (payload.syntheticOnly !== true) fail('syntheticOnly debe ser true');
if (payload.realProspectsUsed !== false) fail('realProspectsUsed debe ser false');
if (payload.productionTouched !== false) fail('productionTouched debe ser false');

const dangerous = spawnSync(process.execPath, [mainScript], {
  encoding: 'utf8',
  env: { ...process.env, NODE_ENV: 'production' }
});
if (dangerous.status === 0) fail('Debe rechazar NODE_ENV=production');

const commitAttempt = spawnSync(process.execPath, [mainScript], {
  encoding: 'utf8',
  env: { ...process.env, ADEIN_DB_COMMIT: '1' }
});
if (commitAttempt.status === 0) fail('Debe rechazar intento de commit real');

let commitPayload;
try { commitPayload = JSON.parse(commitAttempt.stdout); } catch { fail('Salida de rechazo commit no es JSON válido'); }
if (commitPayload.reason !== 'persistent write is not enabled in v066') fail('Razón de abort esperada no coincide');
if (commitPayload.aborted !== true) fail('aborted=true esperado en intento de commit');

const source = fs.readFileSync(mainScript, 'utf8');
if (/\bcommit\s*\(/i.test(source) || /['"`]\s*COMMIT\s*['"`]/i.test(source)) fail('Se detectó patrón de COMMIT ejecutable');
if (/(INSERT|UPDATE|DELETE)\s+INTO\s+`?(clients|contracts|payment_schedule|lots)`?/i.test(source)) fail('Destino prohibido detectado en script');

process.stdout.write(`${JSON.stringify({ ok: true, phase: PHASE, mode: 'self_check', checksPassed: true }, null, 2)}\n`);
