#!/usr/bin/env node
import fs from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const PHASE = 'v073';
const fail = (message) => {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: PHASE, mode: 'self_check', message }, null, 2)}\n`);
  process.exit(1);
};

const planFile = resolve(process.cwd(), 'scripts/crm-prospect-staging-managed-same-origin-bridge-plan-v073.mjs');
const v069SelfCheck = resolve(process.cwd(), 'scripts/crm-prospect-staging-readonly-api-bridge-self-check-v069.mjs');
const v070SelfCheck = resolve(process.cwd(), 'scripts/crm-prospect-staging-dashboard-api-consumption-self-check-v070.mjs');
const v071SelfCheck = resolve(process.cwd(), 'scripts/crm-prospect-staging-same-origin-readonly-snapshot-self-check-v071.mjs');
const v072SelfCheck = resolve(process.cwd(), 'scripts/crm-prospect-staging-same-origin-readonly-process-cleanup-self-check-v072.mjs');
const frontendFiles = [
  resolve(process.cwd(), 'src/pages/OwnerDashboardPage.tsx'),
  resolve(process.cwd(), 'src/lib/crmProspectStagingReadonlyApiClient.ts'),
  resolve(process.cwd(), 'src/lib/crmProspectStagingReadonlySnapshot.ts')
].filter((f) => fs.existsSync(f));

const planSource = fs.readFileSync(planFile, 'utf8');
const srcSource = frontendFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

if (/\bpm2\s+(restart|delete|stop|start)\b/i.test(planSource)) fail('Plan contiene comandos destructivos pm2');
if (/127\.0\.0\.1:3091/i.test(srcSource)) fail('Hardcode frontend a 127.0.0.1:3091 detectado');
if (/from\s+['"](mysql|mysql2|mariadb)['"]|require\(['"](mysql|mysql2|mariadb)['"]\)|\bcreateConnection\s*\(/i.test(srcSource)) fail('mysql/mysql2/mariadb detectado en src');

const planRun = spawnSync(process.execPath, [planFile], { encoding: 'utf8', env: { ...process.env } });
if (planRun.status !== 0) fail(`Plan v073 falló: ${planRun.stderr || planRun.stdout}`);

let planPayload = null;
try { planPayload = JSON.parse(planRun.stdout.trim()); } catch { fail('Salida del plan v073 no es JSON válido'); }

if (!planPayload?.ok) fail('Plan v073 no reportó ok=true');
if (planPayload?.dryRun !== true) fail('Plan v073 no mantiene dryRun=true');
if (planPayload?.productionTouched !== false) fail('Plan v073 no mantiene productionTouched=false');
if (planPayload?.stagingPm2Touched !== false) fail('Plan v073 no mantiene stagingPm2Touched=false');
if (planPayload?.writeExecuted !== false || planPayload?.commitExecuted !== false || planPayload?.transactionStarted !== false) fail('Plan v073 rompió flags de no escritura/commit/transacción');
if (!Array.isArray(planPayload?.rollbackPlan) || planPayload.rollbackPlan.length === 0) fail('Plan v073 sin rollbackPlan');
if (!Array.isArray(planPayload?.requiredManualSteps) || !planPayload.requiredManualSteps.some((x) => /explicit|confirm/i.test(x))) fail('Plan v073 sin gates/manual confirmation explícita');

for (const checkFile of [v069SelfCheck, v070SelfCheck, v071SelfCheck, v072SelfCheck]) {
  const run = spawnSync(process.execPath, [checkFile], { encoding: 'utf8', env: { ...process.env } });
  if (run.status !== 0) fail(`Dependencia ${checkFile} falló: ${run.stderr || run.stdout}`);
}

process.stdout.write(`${JSON.stringify({ ok: true, phase: PHASE, mode: 'self_check', checksPassed: true }, null, 2)}\n`);
