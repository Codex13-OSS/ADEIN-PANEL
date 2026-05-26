#!/usr/bin/env node
import fs from 'node:fs';
import { resolve } from 'node:path';
import { startSameOriginReadonlySnapshotServer } from './crm-prospect-staging-same-origin-readonly-snapshot-server-v071.mjs';

const PHASE = 'v071';
const serverFile = resolve(process.cwd(), 'scripts/crm-prospect-staging-same-origin-readonly-snapshot-server-v071.mjs');
const frontendFiles = [
  resolve(process.cwd(), 'src/pages/OwnerDashboardPage.tsx'),
  resolve(process.cwd(), 'src/lib/crmProspectStagingReadonlyApiClient.ts'),
  resolve(process.cwd(), 'src/lib/crmProspectStagingReadonlySnapshot.ts')
];

const fail = (message) => {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: PHASE, mode: 'self_check', message }, null, 2)}\n`);
  process.exit(1);
};

const sourceServer = fs.readFileSync(serverFile, 'utf8');
const sourceFrontend = frontendFiles.filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');

if (!/ADEIN_CRM_PROSPECT_STAGING_SAME_ORIGIN_READONLY_V071/.test(sourceServer)) fail('Gate explícito v071 no detectado');
if (!/GET \/api\/crm\/prospect-staging\/readonly-snapshot/.test(sourceServer)) fail('Ruta snapshot same-origin no detectada');
if (/from\s+['"](mysql|mysql2|mariadb)['"]|require\(['"](mysql|mysql2|mariadb)['"]\)|\bcreateConnection\s*\(/i.test(sourceFrontend)) fail('Import/uso mysql detectado en src/frontend');
if (/127\.0\.0\.1:3091/i.test(sourceFrontend)) fail('Hardcode frontend a 127.0.0.1:3091 detectado');
if (/ADEIN_DB_TARGET\s*=\s*['"]production['"]|NODE_ENV\s*=\s*['"]production['"]/i.test(sourceServer)) fail('Target producción activo detectado');
if (/password\s*=\s*['"][^'"]+['"]|secret\s*=\s*['"][^'"]+['"]|token\s*=\s*['"][^'"]+['"]/i.test(sourceServer)) fail('Credenciales hardcodeadas detectadas');
if (!/method\s*!==\s*'GET'/.test(sourceServer)) fail('Bloqueo explícito de métodos no GET no detectado');
if (!/\/write|\/commit|\/rollback|\/admin|\/delete|\/production/.test(sourceServer)) fail('Bloqueo de rutas peligrosas no detectado');
if (!/VITE_CRM_PROSPECT_STAGING_READONLY_SNAPSHOT_URL/.test(sourceFrontend)) fail('Fallback configurable v070 no detectado');

const dryRun = await startSameOriginReadonlySnapshotServer();
if (dryRun.started !== false || dryRun.dryRun !== true) fail('Modo por defecto debe ser dry-run sin levantar puerto');

const envBackup = { ...process.env };
try {
  process.env.ADEIN_CRM_PROSPECT_STAGING_SAME_ORIGIN_READONLY_V071 = '1';
  process.env.ADEIN_DB_TARGET = 'staging';
  process.env.ADEIN_SAME_ORIGIN_BIND_HOST = '127.0.0.1';
  process.env.ADEIN_SAME_ORIGIN_PORT = '0';
  process.env.ADEIN_UPSTREAM_READONLY_API = 'http://127.0.0.1:3091/api/crm/prospect-staging/readonly-snapshot';
  const started = await startSameOriginReadonlySnapshotServer();
  if (!started.started) fail('Con gates válidos el servidor debe iniciar');

  const base = `http://${started.bindHost}:${started.port}`;
  const post = await fetch(`${base}/api/crm/prospect-staging/readonly-snapshot`, { method: 'POST' });
  if (post.status !== 405) fail('POST no fue bloqueado con 405');

  const blocked = await fetch(`${base}/admin`, { method: 'GET' });
  if (blocked.status !== 404) fail('Ruta peligrosa no fue bloqueada');

  const unknown = await fetch(`${base}/unknown`, { method: 'GET' });
  if (![200, 503].includes(unknown.status)) fail('Fallback para rutas no peligrosas devolvió estado inválido');

  started.server.close();
} finally {
  process.env = envBackup;
}

process.stdout.write(`${JSON.stringify({ ok: true, phase: PHASE, mode: 'self_check', checksPassed: true }, null, 2)}\n`);
