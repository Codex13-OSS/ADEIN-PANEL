#!/usr/bin/env node
import http from 'node:http';
import { pathToFileURL } from 'node:url';

const PHASE = 'v069';
const MODE_MOCK = 'mock_readonly_api_server';
const SERVICE_NAME = 'crm-prospect-staging-readonly-api-v069';
const ALLOWED_ORIGINS = new Set(['http://127.0.0.1:5173', 'http://localhost:5173', 'http://38.242.222.25:3016']);
const FORBIDDEN_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const ROUTES = ['GET /health', 'GET /api/crm/prospect-staging/readonly-snapshot', 'GET /api/crm/prospect-staging/readonly-evidence'];

const mockSnapshot = {
  ok: true,
  phase: PHASE,
  mode: MODE_MOCK,
  dryRun: true,
  readonly: true,
  databaseConnectionAttempted: false,
  writeExecuted: false,
  commitExecuted: false,
  productionTouched: false,
  dashboardPayloadPreview: {
    summaryCards: { totalProspects: 1, totalConversations: 1, totalAnalyses: 1, totalFollowups: 1, totalHistoryEvents: 1, syntheticRowsDetected: 3 },
    latestProspects: [], followups: [], historyEvents: [],
    sourceBreakdown: { source: [], review_status: [], status: [], intention_level: [] },
    warnings: ['Mock fallback v069.1. Sin conexión BD ni credenciales.']
  }
};

function buildCorsHeaders(req) {
  const origin = req.headers.origin;
  const headers = { Vary: 'Origin', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' };
  if (typeof origin === 'string' && ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(req, res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', ...buildCorsHeaders(req) });
  res.end(JSON.stringify(body, null, 2));
}

function isProductionSignal() {
  return process.env.NODE_ENV === 'production' || process.env.ADEIN_DB_TARGET === 'production' || process.env.ADEIN_DB_ENV === 'production';
}

export function createReadonlyApiServer() {
  return http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, buildCorsHeaders(req));
      res.end();
      return;
    }

    if (req.method !== 'GET') return json(req, res, 405, { ok: false, phase: PHASE, error: 'Method Not Allowed', readonly: true, forbiddenMethods: FORBIDDEN_METHODS });

    if (req.url === '/health') {
      return json(req, res, 200, {
        ok: true,
        phase: PHASE,
        service: SERVICE_NAME,
        mode: MODE_MOCK,
        readonly: true,
        databaseConnectionAttempted: false,
        writeExecuted: false,
        commitExecuted: false,
        productionTouched: false
      });
    }

    if (req.url === '/api/crm/prospect-staging/readonly-snapshot') {
      return json(req, res, 200, mockSnapshot);
    }

    if (req.url === '/api/crm/prospect-staging/readonly-evidence') {
      return json(req, res, 200, {
        ok: true,
        phase: PHASE,
        mode: MODE_MOCK,
        readonly: true,
        verifiedNoTransaction: true,
        verifiedNoWrite: true,
        verifiedNoCommit: true,
        targetDatabase: 'none_mock',
        databaseConnectionAttempted: false,
        writeExecuted: false,
        commitExecuted: false,
        blockedMethods: FORBIDDEN_METHODS,
        routes: ROUTES
      });
    }

    return json(req, res, 404, { ok: false, phase: PHASE, error: 'Not Found', readonly: true });
  });
}

export async function startReadonlyApiServer({ host = process.env.ADEIN_API_BIND_HOST || '127.0.0.1', port = Number(process.env.ADEIN_API_PORT || 3091) } = {}) {
  if (isProductionSignal()) throw new Error('Abortado por señal de producción');
  if (host !== '127.0.0.1') throw new Error('Bind host inválido; solo 127.0.0.1 permitido');

  const server = createReadonlyApiServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  return { server, host, port };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { host, port } = await startReadonlyApiServer();
    console.log(JSON.stringify({
      ok: true,
      phase: PHASE,
      mode: MODE_MOCK,
      serverStarted: true,
      databaseConnectionAttempted: false,
      readonly: true,
      writeExecuted: false,
      commitExecuted: false,
      productionTouched: false,
      bindHost: host,
      port,
      routes: ROUTES
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, phase: PHASE, aborted: true, error: error?.message || String(error) }, null, 2));
    process.exit(1);
  }
}
