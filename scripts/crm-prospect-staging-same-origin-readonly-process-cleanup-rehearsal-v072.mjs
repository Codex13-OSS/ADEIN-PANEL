#!/usr/bin/env node
import net from 'node:net';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const PHASE = 'v072';
const MODE = 'process_cleanup_rehearsal';
const DEFAULT_V069_PORT = Number(process.env.ADEIN_V072_TEST_READONLY_PORT || 3191);
const DEFAULT_V071_PORT = Number(process.env.ADEIN_V072_TEST_SAME_ORIGIN_PORT || 3126);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolvePort) => {
    const socket = new net.Socket();
    socket.once('connect', () => {
      socket.destroy();
      resolvePort(true);
    });
    socket.once('error', () => resolvePort(false));
    socket.connect(port, host);
  });
}

async function assertPortFreeOrAbort(port) {
  if (await isPortInUse(port)) throw new Error(`Puerto de prueba ocupado: ${port}`);
}

function spawnNodeScript(scriptPath, extraEnv = {}) {
  const child = spawn(process.execPath, [scriptPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...extraEnv }
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d.toString(); });
  child.stderr.on('data', (d) => { stderr += d.toString(); });

  return { child, getStdout: () => stdout, getStderr: () => stderr };
}

async function waitForPort(port, timeoutMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortInUse(port)) return true;
    await sleep(120);
  }
  return false;
}

async function stopChild(child, timeoutMs = 5000) {
  if (child.exitCode !== null) return true;
  child.kill('SIGTERM');
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (child.exitCode !== null) return true;
    await sleep(100);
  }
  child.kill('SIGKILL');
  await sleep(150);
  return child.exitCode !== null;
}

async function main() {
  const v069Port = DEFAULT_V069_PORT;
  const v071Port = DEFAULT_V071_PORT;
  const portsChecked = [v069Port, v071Port];
  const processesStarted = [];
  const processesStopped = [];

  await assertPortFreeOrAbort(v069Port);
  await assertPortFreeOrAbort(v071Port);

  const v069Script = resolve(process.cwd(), 'scripts/crm-prospect-staging-readonly-api-server-v069.mjs');
  const v071Script = resolve(process.cwd(), 'scripts/crm-prospect-staging-same-origin-readonly-snapshot-server-v071.mjs');

  const v069 = spawnNodeScript(v069Script, {
    ADEIN_DB_TARGET: 'staging',
    ADEIN_API_BIND_HOST: '127.0.0.1',
    ADEIN_API_PORT: String(v069Port)
  });
  processesStarted.push({ name: 'v069', pid: v069.child.pid, port: v069Port });

  const v069Up = await waitForPort(v069Port);
  if (!v069Up) throw new Error(`v069 no inició en puerto ${v069Port}. stderr=${v069.getStderr()}`);

  const v071 = spawnNodeScript(v071Script, {
    ADEIN_CRM_PROSPECT_STAGING_SAME_ORIGIN_READONLY_V071: '1',
    ADEIN_DB_TARGET: 'staging',
    ADEIN_V072_TEST_MODE: '1',
    ADEIN_SAME_ORIGIN_BIND_HOST: '127.0.0.1',
    ADEIN_SAME_ORIGIN_PORT: String(v071Port),
    ADEIN_UPSTREAM_READONLY_API: `http://127.0.0.1:${v069Port}/api/crm/prospect-staging/readonly-snapshot`,
    ADEIN_UPSTREAM_READONLY_EVIDENCE_API: `http://127.0.0.1:${v069Port}/api/crm/prospect-staging/readonly-evidence`
  });
  processesStarted.push({ name: 'v071', pid: v071.child.pid, port: v071Port });

  const v071Up = await waitForPort(v071Port);
  if (!v071Up) throw new Error(`v071 no inició en puerto ${v071Port}. stderr=${v071.getStderr()}`);

  const stoppedV071 = await stopChild(v071.child);
  processesStopped.push({ name: 'v071', pid: v071.child.pid, stopped: stoppedV071 });

  const stoppedV069 = await stopChild(v069.child);
  processesStopped.push({ name: 'v069', pid: v069.child.pid, stopped: stoppedV069 });

  await sleep(200);
  const lingering = [];
  for (const p of portsChecked) {
    if (await isPortInUse(p)) lingering.push(p);
  }

  const result = {
    ok: lingering.length === 0 && processesStopped.every((x) => x.stopped),
    phase: PHASE,
    mode: MODE,
    processesStarted,
    processesStopped,
    portsChecked,
    lingeringProcesses: lingering.length > 0,
    productionTouched: false,
    stagingPm2Touched: false,
    writeExecuted: false,
    commitExecuted: false,
    transactionStarted: false
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, phase: PHASE, mode: MODE, error: error?.message || String(error) }, null, 2)}\n`);
  process.exit(1);
});
