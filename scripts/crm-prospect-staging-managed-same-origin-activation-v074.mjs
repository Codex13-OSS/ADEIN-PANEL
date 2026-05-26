#!/usr/bin/env node
import net from 'node:net';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const PHASE = 'v074';
const GATE = process.env.ADEIN_CRM_PROSPECT_STAGING_MANAGED_SAME_ORIGIN_ACTIVATION_V074 === '1';
const MODE = process.env.ADEIN_V074_MODE || 'activation_preflight_dry_run';
const V069_TEST_PORT = Number(process.env.ADEIN_V074_TEST_READONLY_PORT || 3191);
const V071_TEST_PORT = Number(process.env.ADEIN_V074_TEST_SAME_ORIGIN_PORT || 3126);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolvePort) => {
    const socket = new net.Socket();
    socket.once('connect', () => { socket.destroy(); resolvePort(true); });
    socket.once('error', () => resolvePort(false));
    socket.connect(port, host);
  });
}

async function assertPortFree(port) {
  if (await isPortInUse(port)) throw new Error(`Puerto de prueba ocupado: ${port}`);
}

async function waitForPort(port, timeoutMs = 7000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortInUse(port)) return true;
    await sleep(120);
  }
  return false;
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return true;
  child.kill('SIGTERM');
  const start = Date.now();
  while (Date.now() - start < 4500) {
    if (child.exitCode !== null) return true;
    await sleep(100);
  }
  child.kill('SIGKILL');
  await sleep(120);
  return child.exitCode !== null;
}

function spawnScript(scriptPath, envExtra) {
  const child = spawn(process.execPath, [scriptPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...envExtra }
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d.toString(); });
  child.stderr.on('data', (d) => { stderr += d.toString(); });
  return { child, getStdout: () => stdout, getStderr: () => stderr };
}

async function fetchJson(url, { method = 'GET', expectStatus = 200 } = {}) {
  const resp = await fetch(url, { method });
  const text = await resp.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 300) }; }
  return { ok: resp.status === expectStatus, status: resp.status, body };
}

function basePayload() {
  return {
    ok: true,
    phase: PHASE,
    mode: 'activation_preflight_dry_run',
    dryRun: true,
    productionTouched: false,
    stagingPm2Touched: false,
    writeExecuted: false,
    commitExecuted: false,
    transactionStarted: false,
    persistentProcessStarted: false,
    activationExecuted: false,
    currentStaging: {
      pm2App: 'adein-panel-staging-v052',
      currentPort: 3016,
      currentMode: 'serve static fallback'
    },
    targetStaging: {
      publicPort: 3016,
      sameOriginServer: 'v071',
      localReadonlyApi: '127.0.0.1:3091',
      frontendEndpointEnv: '/api/crm/prospect-staging/readonly-snapshot'
    },
    controlledActivationPlan: [
      'backup current PM2 info',
      'build with VITE_CRM_PROSPECT_STAGING_READONLY_SNAPSHOT_URL=/api/crm/prospect-staging/readonly-snapshot',
      'start v069 local read-only API using gates',
      'validate 127.0.0.1:3091/health',
      'switch staging PM2 command to v071 same-origin server only after human approval',
      'validate 127.0.0.1:3016/health',
      'validate 127.0.0.1:3016/api/crm/prospect-staging/readonly-snapshot',
      'validate public 38.242.222.25:3016',
      'validate visual dashboard'
    ],
    rollbackPlan: [
      'stop v071 same-origin PM2/process',
      'restore serve -s /opt/ADEIN-PANEL-staging-v052/dist -l 3016',
      'stop v069 local API',
      'confirm 3006/3016 HTTP 200',
      'confirm no listeners on public/exposed 3091'
    ],
    abortConditions: [
      '3006 affected', '3016 unhealthy', '3091 exposed publicly', 'snapshot invalid',
      'any write/commit/transaction flag true', 'productionTouched true', 'lingering processes true',
      'PM2 app mismatch', 'env file missing', 'build fails', 'rollback command missing'
    ],
    manualActivationArtifact: {
      guardedMode: 'controlled_real_activation',
      requiredGates: [
        'ADEIN_CRM_PROSPECT_STAGING_MANAGED_SAME_ORIGIN_ACTIVATION_V074=1',
        'ADEIN_V074_MODE=controlled_real_activation',
        'ADEIN_DB_TARGET=staging',
        'ADEIN_REQUIRE_HUMAN_APPROVAL=I_UNDERSTAND_THIS_CHANGES_STAGING_PM2',
        'ADEIN_CONFIRM_NO_PRODUCTION=1',
        'ADEIN_CONFIRM_ROLLBACK_READY=1'
      ],
      codexExecutionPolicy: 'prints instructions only; no pm2 execution'
    }
  };
}

async function runRehearsal() {
  await assertPortFree(V069_TEST_PORT);
  await assertPortFree(V071_TEST_PORT);

  const payload = basePayload();
  payload.mode = 'rehearsal';
  payload.dryRun = false;

  const v069 = spawnScript(resolve(process.cwd(), 'scripts/crm-prospect-staging-readonly-api-server-v069.mjs'), {
    ADEIN_DB_TARGET: 'staging', ADEIN_API_BIND_HOST: '127.0.0.1', ADEIN_API_PORT: String(V069_TEST_PORT)
  });
  if (!(await waitForPort(V069_TEST_PORT))) throw new Error(`v069 rehearsal no inició: ${v069.getStderr()}`);

  const v071 = spawnScript(resolve(process.cwd(), 'scripts/crm-prospect-staging-same-origin-readonly-snapshot-server-v071.mjs'), {
    ADEIN_CRM_PROSPECT_STAGING_SAME_ORIGIN_READONLY_V071: '1',
    ADEIN_DB_TARGET: 'staging', ADEIN_V072_TEST_MODE: '1',
    ADEIN_SAME_ORIGIN_BIND_HOST: '127.0.0.1', ADEIN_SAME_ORIGIN_PORT: String(V071_TEST_PORT),
    ADEIN_UPSTREAM_READONLY_API: `http://127.0.0.1:${V069_TEST_PORT}/api/crm/prospect-staging/readonly-snapshot`,
    ADEIN_UPSTREAM_READONLY_EVIDENCE_API: `http://127.0.0.1:${V069_TEST_PORT}/api/crm/prospect-staging/readonly-evidence`
  });
  if (!(await waitForPort(V071_TEST_PORT))) throw new Error(`v071 rehearsal no inició: ${v071.getStderr()}`);

  payload.persistentProcessStarted = true;
  const checks = {
    v069Health: await fetchJson(`http://127.0.0.1:${V069_TEST_PORT}/health`),
    v071Health: await fetchJson(`http://127.0.0.1:${V071_TEST_PORT}/health`),
    sameOriginSnapshot: await fetchJson(`http://127.0.0.1:${V071_TEST_PORT}/api/crm/prospect-staging/readonly-snapshot`),
    postBlocked: await fetchJson(`http://127.0.0.1:${V071_TEST_PORT}/api/crm/prospect-staging/readonly-snapshot`, { method: 'POST', expectStatus: 405 }),
    dangerousRouteBlocked: await fetchJson(`http://127.0.0.1:${V071_TEST_PORT}/api/crm/prospect-staging/write-test`, { method: 'POST', expectStatus: 405 })
  };

  const stopV071 = await stopChild(v071.child);
  const stopV069 = await stopChild(v069.child);
  await sleep(220);
  const lingering = [];
  if (await isPortInUse(V069_TEST_PORT)) lingering.push(V069_TEST_PORT);
  if (await isPortInUse(V071_TEST_PORT)) lingering.push(V071_TEST_PORT);

  payload.checks = checks;
  payload.cleanup = { stopV071, stopV069, lingeringProcesses: lingering.length > 0, lingeringPorts: lingering };
  payload.ok = Object.values(checks).every((x) => x.ok) && stopV069 && stopV071 && lingering.length === 0;
  return payload;
}

function runControlledRealActivationInstructions() {
  const payload = basePayload();
  payload.mode = 'controlled_real_activation';
  payload.dryRun = true;
  payload.activationExecuted = false;
  payload.instructionsOnly = true;
  payload.manualCommands = [
    'manual: backup PM2 metadata for adein-panel-staging-v052',
    'VITE_CRM_PROSPECT_STAGING_READONLY_SNAPSHOT_URL=/api/crm/prospect-staging/readonly-snapshot npm run build',
    'ADEIN_DB_TARGET=staging ADEIN_DB_READONLY_API=1 ADEIN_API_BIND_HOST=127.0.0.1 ADEIN_API_PORT=3091 npm run crm:prospect-staging:readonly-api-server',
    'curl -fsS http://127.0.0.1:3091/health',
    'manual: switch staging app command to v071 same-origin snapshot server after approval',
    'curl -fsS http://127.0.0.1:3016/health',
    'curl -fsS http://127.0.0.1:3016/api/crm/prospect-staging/readonly-snapshot'
  ];
  return payload;
}

async function main() {
  if (MODE === 'activation_preflight_dry_run' || !MODE) return basePayload();
  if (!GATE) throw new Error('Modo no-dry-run bloqueado: falta ADEIN_CRM_PROSPECT_STAGING_MANAGED_SAME_ORIGIN_ACTIVATION_V074=1');
  if (MODE === 'rehearsal') return runRehearsal();
  if (MODE === 'controlled_real_activation') return runControlledRealActivationInstructions();
  throw new Error(`ADEIN_V074_MODE no soportado: ${MODE}`);
}

main().then((result) => {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exit(1);
}).catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, phase: PHASE, mode: MODE, error: error.message }, null, 2)}\n`);
  process.exit(1);
});
