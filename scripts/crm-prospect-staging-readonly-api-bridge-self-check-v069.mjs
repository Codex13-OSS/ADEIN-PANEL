#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { startReadonlyApiServer } from './crm-prospect-staging-readonly-api-server-v069.mjs';

const PHASE = 'v069';
const bridgeScript = resolve(process.cwd(), 'scripts/crm-prospect-staging-readonly-api-bridge-v069.mjs');
const serverScript = resolve(process.cwd(), 'scripts/crm-prospect-staging-readonly-api-server-v069.mjs');
const clientFile = resolve(process.cwd(), 'src/lib/crmProspectStagingReadonlyApiClient.ts');

const fail = (message) => {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: PHASE, mode: 'self_check', message }, null, 2)}\n`);
  process.exit(1);
};

const run = (file, env = {}) => spawnSync(process.execPath, [file], { encoding: 'utf8', env: { ...process.env, ...env } });

const dry = run(bridgeScript);
if (dry.status !== 0) fail('Bridge dry-run falló');
const payload = JSON.parse(dry.stdout);
for (const key of ['ok','phase','mode','dryRun','databaseConnectionAttempted','serverStarted','writeExecuted','commitExecuted','readonly','productionTouched','bridgePlan','allowedRoutes','forbiddenRoutes','snapshotContract','safetyEnvelope']) {
  if (!(key in payload)) fail(`Falta key ${key}`);
}
if (payload.mode !== 'dry_run' || payload.databaseConnectionAttempted !== false || payload.serverStarted !== false || payload.readonly !== true || payload.writeExecuted !== false || payload.commitExecuted !== false || payload.productionTouched !== false) fail('Contrato dry-run inválido');
if (payload.allowedRoutes.some((route) => !route.startsWith('GET '))) fail('Hay rutas permitidas no-GET');
if (!payload.forbiddenRoutes.includes('/write')) fail('No bloquea /write');

if (run(serverScript, { NODE_ENV: 'production' }).status === 0) fail('Server debe abortar con NODE_ENV=production');
if (run(serverScript, { ADEIN_DB_TARGET: 'production' }).status === 0) fail('Server debe abortar con ADEIN_DB_TARGET=production');
if (run(serverScript, { ADEIN_DB_ENV: 'production' }).status === 0) fail('Server debe abortar con ADEIN_DB_ENV=production');

const mainSource = fs.readFileSync(serverScript, 'utf8');
const clientSource = fs.readFileSync(clientFile, 'utf8');
if (/\b(mysql|mysql2)\b/i.test(clientSource)) fail('Client no debe importar mysql/mysql2');
if (/\b(import\.meta\.env|process\.env|password|token|secret|ADEIN_DB_)\b/i.test(clientSource)) fail('Client no debe leer env/credenciales');
if (/\b(INSERT\s+INTO|UPDATE\s+[`\"\w]|DELETE\s+FROM|ALTER\s+TABLE|DROP\s+TABLE|TRUNCATE\s+TABLE|CREATE\s+TABLE|REPLACE\s+INTO)\b/i.test(mainSource)) fail('Keywords SQL peligrosas no permitidas en server mock/local');
if (/ADEIN_DB_ENV_FILE/.test(mainSource)) fail('Server mock/local no debe leer ADEIN_DB_ENV_FILE por defecto');
if (/\/\b(api\/)?(write|commit|rollback|admin)\b/i.test(mainSource)) fail('Rutas write-like no permitidas detectadas');

const { server, port } = await startReadonlyApiServer({ host: '127.0.0.1', port: 3095 });
try {
  const base = `http://127.0.0.1:${port}`;
  const health = await fetch(`${base}/health`);
  if (health.status !== 200) fail('health no responde 200');

  const snapshot = await fetch(`${base}/api/crm/prospect-staging/readonly-snapshot`);
  if (snapshot.status !== 200) fail('readonly-snapshot no responde 200');
  const snapshotPayload = await snapshot.json();
  if (snapshotPayload.databaseConnectionAttempted !== false || snapshotPayload.writeExecuted !== false || snapshotPayload.commitExecuted !== false) fail('Snapshot no cumple contrato read-only mock');

  const evidence = await fetch(`${base}/api/crm/prospect-staging/readonly-evidence`);
  if (evidence.status !== 200) fail('readonly-evidence no responde 200');
  const evidencePayload = await evidence.json();
  if (evidencePayload.verifiedNoWrite !== true || evidencePayload.verifiedNoCommit !== true || evidencePayload.databaseConnectionAttempted !== false) fail('Evidencia mock inválida');

  const post = await fetch(`${base}/health`, { method: 'POST' });
  if (post.status !== 405) fail('POST debe retornar 405');

  const notFound = await fetch(`${base}/route-not-found`);
  if (notFound.status !== 404) fail('Ruta desconocida debe retornar 404');
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}

process.stdout.write(`${JSON.stringify({ ok: true, phase: PHASE, mode: 'self_check', checksPassed: true }, null, 2)}\n`);
