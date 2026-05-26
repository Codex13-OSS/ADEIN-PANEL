#!/usr/bin/env node
import fs from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const PHASE = 'v070';
const dashboardPage = resolve(process.cwd(), 'src/pages/OwnerDashboardPage.tsx');
const snapshotLib = resolve(process.cwd(), 'src/lib/crmProspectStagingReadonlySnapshot.ts');
const apiClientLib = resolve(process.cwd(), 'src/lib/crmProspectStagingReadonlyApiClient.ts');
const bridgeScript = resolve(process.cwd(), 'scripts/crm-prospect-staging-readonly-api-bridge-v069.mjs');

const fail = (message) => {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: PHASE, mode: 'self_check', message }, null, 2)}\n`);
  process.exit(1);
};

const files = [dashboardPage, snapshotLib, apiClientLib];
const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

if (/https?:\/\/127\.0\.0\.1:3091/i.test(source)) fail('Hardcode activo a 127.0.0.1:3091 detectado en frontend');
if (/from\s+['\"](mysql|mysql2|mariadb)['\"]|require\(['\"](mysql|mysql2|mariadb)['\"]\)|\bcreateConnection\s*\(/i.test(source)) fail('Conexión directa MariaDB detectada en src');
if (/\b(password|passwd|secret|token\s*=\s*['"][^'"]+['"])\b/i.test(source)) fail('Posibles secretos en la nueva capa');
if (/\b(transaction|commit|writeExecuted\s*=\s*true)\b/i.test(source)) fail('Indicios de escritura/commit/transacción en capa frontend');
if (!/SAFE_STAGING_READONLY_FALLBACK/.test(source)) fail('Fallback local seguro no detectado');
if (!/__ADEIN_CRM_PROSPECT_STAGING_READONLY_SNAPSHOT_URL__/.test(source)) fail('Endpoint opcional configurable no detectado');
if (/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE|REPLACE)\b/i.test(source)) fail('Keywords SQL peligrosas detectadas en capa nueva');
if (/https?:\/\/(?!localhost)(?!127\.0\.0\.1)/i.test(source)) fail('Endpoint público externo hardcodeado detectado');

const bridgeSource = fs.readFileSync(bridgeScript, 'utf8');
if (/writeExecuted:\s*true|commitExecuted:\s*true|productionTouched:\s*true/.test(bridgeSource)) fail('Bridge v069 dejó de estar en modo read-only');

const buildCheck = spawnSync('npm', ['run', 'build'], { encoding: 'utf8' });
if (buildCheck.status !== 0) fail('OwnerDashboard/build no compila en self-check v070');

process.stdout.write(`${JSON.stringify({ ok: true, phase: PHASE, mode: 'self_check', checksPassed: true }, null, 2)}\n`);
