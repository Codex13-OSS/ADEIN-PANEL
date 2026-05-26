#!/usr/bin/env node
import fs from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const PHASE = 'v072';
const fail = (message) => {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: PHASE, mode: 'self_check', message }, null, 2)}\n`);
  process.exit(1);
};

const v069File = resolve(process.cwd(), 'scripts/crm-prospect-staging-readonly-api-server-v069.mjs');
const v071File = resolve(process.cwd(), 'scripts/crm-prospect-staging-same-origin-readonly-snapshot-server-v071.mjs');
const rehearsalFile = resolve(process.cwd(), 'scripts/crm-prospect-staging-same-origin-readonly-process-cleanup-rehearsal-v072.mjs');
const frontendFiles = [
  resolve(process.cwd(), 'src/pages/OwnerDashboardPage.tsx'),
  resolve(process.cwd(), 'src/lib/crmProspectStagingReadonlyApiClient.ts'),
  resolve(process.cwd(), 'src/lib/crmProspectStagingReadonlySnapshot.ts')
].filter((f) => fs.existsSync(f));

const v069Source = fs.readFileSync(v069File, 'utf8');
const v071Source = fs.readFileSync(v071File, 'utf8');
const rehearsalSource = fs.readFileSync(rehearsalFile, 'utf8');
const srcSource = frontendFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

if (!/process\.on\('SIGTERM'/.test(v069Source) || !/server\.close/.test(v069Source)) fail('v069 sin shutdown handler SIGTERM/server.close');
if (!/process\.on\('SIGTERM'/.test(v071Source) || !/server\.close/.test(v071Source)) fail('v071 sin shutdown handler SIGTERM/server.close');
if (/127\.0\.0\.1:3091/i.test(srcSource)) fail('Hardcode frontend a 127.0.0.1:3091 detectado');
if (/from\s+['"](mysql|mysql2|mariadb)['"]|require\(['"](mysql|mysql2|mariadb)['"]\)|\bcreateConnection\s*\(/i.test(srcSource)) fail('mysql/mysql2/mariadb detectado en src');
if (/\bpm2\b/i.test(rehearsalSource)) fail('Comandos pm2 detectados en script v072');
if (/3006/.test(rehearsalSource)) fail('Puerto 3006 detectado en script v072');
if (/\b(BEGIN|COMMIT|ROLLBACK|INSERT|UPDATE|DELETE)\b/i.test(rehearsalSource)) fail('Patrones de write/transacción detectados en script v072');

const run = spawnSync(process.execPath, [rehearsalFile], { encoding: 'utf8', env: { ...process.env } });
if (run.status !== 0) fail(`Rehearsal v072 falló: ${run.stderr || run.stdout}`);

let parsed = null;
try { parsed = JSON.parse(run.stdout.trim()); } catch {}
if (!parsed?.ok || parsed?.lingeringProcesses !== false) fail('Rehearsal no confirmó cleanup sin procesos colgando');

process.stdout.write(`${JSON.stringify({ ok: true, phase: PHASE, mode: 'self_check', checksPassed: true }, null, 2)}\n`);
