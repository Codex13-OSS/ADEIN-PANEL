#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import { resolve, extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';

const PHASE = 'v071';
const SERVICE_NAME = 'crm-prospect-staging-same-origin-readonly-snapshot';
const DIST_DIR = resolve(process.cwd(), 'dist');
const FORBIDDEN_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const BLOCKED_PATH_SEGMENTS = ['/write', '/commit', '/rollback', '/admin', '/delete', '/production'];
const READONLY_ROUTES = [
  'GET /',
  'GET /assets/*',
  'GET /api/crm/prospect-staging/readonly-snapshot',
  'GET /api/crm/prospect-staging/readonly-evidence',
  'GET /health'
];
const DEFAULT_UPSTREAM_SNAPSHOT = 'http://127.0.0.1:3091/api/crm/prospect-staging/readonly-snapshot';
const DEFAULT_UPSTREAM_EVIDENCE = 'http://127.0.0.1:3091/api/crm/prospect-staging/readonly-evidence';

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2']
]);

function json(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}

function parseRuntimeConfig() {
  const bindHost = process.env.ADEIN_SAME_ORIGIN_BIND_HOST || '127.0.0.1';
  const port = Number(process.env.ADEIN_SAME_ORIGIN_PORT || 3016);
  const upstreamSnapshot = process.env.ADEIN_UPSTREAM_READONLY_API || DEFAULT_UPSTREAM_SNAPSHOT;
  const upstreamEvidence = process.env.ADEIN_UPSTREAM_READONLY_EVIDENCE_API || DEFAULT_UPSTREAM_EVIDENCE;
  return { bindHost, port, upstreamSnapshot, upstreamEvidence };
}

function isActivationEnabled() {
  return process.env.ADEIN_CRM_PROSPECT_STAGING_SAME_ORIGIN_READONLY_V071 === '1';
}

function evaluateGates(config) {
  const testMode = process.env.ADEIN_V072_TEST_MODE === '1';
  const testUpstreamAllowed = testMode && /^http:\/\/127\.0\.0\.1:\d+\/api\/crm\/prospect-staging\/readonly-snapshot/.test(config.upstreamSnapshot);
  return {
    activationEnabled: isActivationEnabled(),
    targetIsStaging: process.env.ADEIN_DB_TARGET === 'staging',
    bindHostAllowed: config.bindHost === '127.0.0.1' || config.bindHost === '0.0.0.0',
    upstreamIsLocalReadonlySnapshot: config.upstreamSnapshot.startsWith('http://127.0.0.1:3091/api/crm/prospect-staging/readonly-snapshot'),
    testUpstreamAllowed
  };
}

function assertNoProductionSignals() {
  if (process.env.ADEIN_DB_TARGET === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error('Abortado por señal de producción');
  }
}

async function fetchJsonWithTimeout(url, timeoutMs = 1800) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: ctl.signal });
    const payload = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, payload };
  } finally {
    clearTimeout(timer);
  }
}

function isReadonlyPayloadValid(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.readonly !== true) return false;
  if (payload.writeExecuted !== false) return false;
  if (payload.commitExecuted !== false) return false;
  if (Object.prototype.hasOwnProperty.call(payload, 'transactionStarted') && payload.transactionStarted !== false) return false;
  if (payload.productionTouched !== false) return false;
  return true;
}

function buildServer(config) {
  return http.createServer(async (req, res) => {
    const reqPath = (req.url || '/').split('?')[0];

    if (FORBIDDEN_METHODS.includes(req.method || '')) return json(res, 405, { ok: false, phase: PHASE, readonly: true, error: 'Method Not Allowed' });
    if (req.method !== 'GET') return json(res, 405, { ok: false, phase: PHASE, readonly: true, error: 'Only GET allowed' });
    if (BLOCKED_PATH_SEGMENTS.some((segment) => reqPath.toLowerCase().includes(segment))) return json(res, 404, { ok: false, phase: PHASE, readonly: true, error: 'Not Found' });

    if (reqPath === '/health') {
      return json(res, 200, { ok: true, phase: PHASE, service: SERVICE_NAME, readonly: true, targetDatabase: 'staging', writeExecuted: false, commitExecuted: false, productionTouched: false });
    }

    if (reqPath === '/api/crm/prospect-staging/readonly-snapshot') {
      try {
        const upstream = await fetchJsonWithTimeout(config.upstreamSnapshot, 2000);
        if (!upstream.ok || !isReadonlyPayloadValid(upstream.payload)) {
          return json(res, 503, { ok: false, phase: PHASE, readonly: true, fallbackSafe: true, error: 'Upstream readonly snapshot unavailable or invalid' });
        }
        return json(res, 200, upstream.payload);
      } catch {
        return json(res, 503, { ok: false, phase: PHASE, readonly: true, fallbackSafe: true, error: 'Upstream readonly snapshot unreachable' });
      }
    }

    if (reqPath === '/api/crm/prospect-staging/readonly-evidence') {
      try {
        const upstream = await fetchJsonWithTimeout(config.upstreamEvidence, 2000);
        if (!upstream.ok || !isReadonlyPayloadValid(upstream.payload)) {
          return json(res, 503, { ok: false, phase: PHASE, readonly: true, error: 'Upstream readonly evidence unavailable or invalid' });
        }
        return json(res, 200, upstream.payload);
      } catch {
        return json(res, 503, { ok: false, phase: PHASE, readonly: true, error: 'Upstream readonly evidence unreachable' });
      }
    }

    const safePath = normalize(reqPath).replace(/^\/+/, '');
    const distPath = resolve(DIST_DIR, safePath);
    const distAssetsRoot = resolve(DIST_DIR, 'assets');

    if (reqPath.startsWith('/assets/') && distPath.startsWith(distAssetsRoot) && fs.existsSync(distPath) && fs.statSync(distPath).isFile()) {
      const ext = extname(distPath);
      const mime = MIME_TYPES.get(ext) || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(distPath).pipe(res);
      return;
    }

    const htmlPath = join(DIST_DIR, 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(htmlPath).pipe(res);
      return;
    }

    return json(res, 503, { ok: false, phase: PHASE, readonly: true, error: 'dist no disponible, ejecutar build primero' });
  });
}

export async function startSameOriginReadonlySnapshotServer({ host, port } = {}) {
  assertNoProductionSignals();
  const config = parseRuntimeConfig();
  if (host) config.bindHost = host;
  if (port) config.port = port;

  const gates = evaluateGates(config);
  if (!gates.activationEnabled) {
    return { started: false, dryRun: true, phase: PHASE, message: 'Gate no activo: no se inicia servidor', gates, config, routes: READONLY_ROUTES };
  }
  if (!gates.targetIsStaging) throw new Error('ADEIN_DB_TARGET debe ser staging');
  if (!gates.bindHostAllowed) throw new Error('ADEIN_SAME_ORIGIN_BIND_HOST debe ser 127.0.0.1 o 0.0.0.0');
  if (!gates.upstreamIsLocalReadonlySnapshot && !gates.testUpstreamAllowed) throw new Error('ADEIN_UPSTREAM_READONLY_API debe apuntar al upstream local read-only 127.0.0.1:3091 (o test mode v072 local)');

  const server = buildServer(config);
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(config.port, config.bindHost, resolveListen);
  });

  const address = server.address();
  const activePort = typeof address === 'object' && address ? address.port : config.port;
  return { started: true, dryRun: false, phase: PHASE, readonly: true, bindHost: config.bindHost, port: activePort, routes: READONLY_ROUTES, server };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await startSameOriginReadonlySnapshotServer();
    const { server, ...safe } = result;
    if (server) {
      const shutdown = (signal) => {
        server.close(() => {
          process.stdout.write(`${JSON.stringify({ ok: true, phase: PHASE, mode: 'runtime', shutdown: true, signal, writeExecuted: false, commitExecuted: false, transactionStarted: false, productionTouched: false }, null, 2)}\n`);
          process.exit(0);
        });
      };
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    }
    process.stdout.write(`${JSON.stringify(safe, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, phase: PHASE, aborted: true, error: error?.message || String(error) }, null, 2)}\n`);
    process.exit(1);
  }
}
