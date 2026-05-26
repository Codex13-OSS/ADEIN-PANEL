#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { runControlledReadonlySnapshot } from './lib/crm-prospect-staging-readonly-v069-shared.mjs';

const PHASE = 'v069';
const MODE_MOCK = 'mock_readonly_api_server';
const MODE_CONTROLLED = 'controlled_readonly_api_server';
const SERVICE_NAME = 'crm-prospect-staging-readonly-api-v069';
const ALLOWED_ORIGINS = new Set(['http://127.0.0.1:5173', 'http://localhost:5173', 'http://38.242.222.25:3016']);
const FORBIDDEN_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const ROUTES = ['GET /health', 'GET /api/crm/prospect-staging/readonly-snapshot', 'GET /api/crm/prospect-staging/readonly-evidence'];

const mockSnapshot = {
  ok: true, phase: PHASE, mode: MODE_MOCK, dryRun: true, readonly: true, databaseConnectionAttempted: false,
  writeExecuted: false, commitExecuted: false, transactionStarted: false, productionTouched: false, targetDatabase: 'none_mock',
  dashboardPayloadPreview: {
    summaryCards: { totalProspects: 1, totalConversations: 1, totalAnalyses: 1, totalFollowups: 1, totalHistoryEvents: 1, syntheticRowsDetected: 3 },
    latestProspects: [], followups: [], historyEvents: [],
    sourceBreakdown: { source: [], review_status: [], status: [], intention_level: [] },
    warnings: ['Mock fallback v069.2. Sin conexión BD ni credenciales.']
  }
};

const buildMockEvidence = () => ({
  ok: true, phase: PHASE, mode: MODE_MOCK, readonly: true, verifiedNoTransaction: true, verifiedNoWrite: true, verifiedNoCommit: true,
  targetDatabase: 'none_mock', databaseConnectionAttempted: false, writeExecuted: false, commitExecuted: false, transactionStarted: false,
  productionTouched: false, blockedMethods: FORBIDDEN_METHODS, routes: ROUTES
});

const isProductionSignal = () => process.env.NODE_ENV === 'production' || process.env.ADEIN_DB_TARGET === 'production' || process.env.ADEIN_DB_ENV === 'production';

function controlledGateStatus(host, port) {
  const controlledEnabled = process.env.ADEIN_CRM_PROSPECT_STAGING_READONLY_API_V069 === '1';
  const hasEnvFile = Boolean(process.env.ADEIN_DB_ENV_FILE);
  const envFileExists = hasEnvFile && fs.existsSync(process.env.ADEIN_DB_ENV_FILE);
  return {
    controlledEnabled,
    envFilePathConfigured: hasEnvFile,
    envFileExists,
    targetIsStaging: process.env.ADEIN_DB_TARGET === 'staging',
    readonlyApiGate: process.env.ADEIN_DB_READONLY_API === '1',
    bindHostLocalOnly: host === '127.0.0.1',
    portIsDefaultReadonly: port === 3091
  };
}

function normalizeControlledPayload(snapshot) {
  return {
    ...snapshot,
    phase: PHASE,
    mode: MODE_CONTROLLED,
    readonly: true,
    writeExecuted: false,
    commitExecuted: false,
    transactionStarted: false,
    productionTouched: false,
    targetDatabase: 'staging',
    missingTables: Array.isArray(snapshot.missingTables) ? snapshot.missingTables : []
  };
}

function buildCorsHeaders(req) { const origin = req.headers.origin; const h = { Vary: 'Origin', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' }; if (typeof origin === 'string' && ALLOWED_ORIGINS.has(origin)) h['Access-Control-Allow-Origin'] = origin; return h; }
function json(req, res, statusCode, body) { res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', ...buildCorsHeaders(req) }); res.end(JSON.stringify(body, null, 2)); }

export function createReadonlyApiServer({ runtime } = {}) {
  const state = runtime || { mode: MODE_MOCK, snapshot: mockSnapshot, evidence: buildMockEvidence() };
  return http.createServer((req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, buildCorsHeaders(req)); res.end(); return; }
    if (req.method !== 'GET') return json(req, res, 405, { ok: false, phase: PHASE, error: 'Method Not Allowed', readonly: true, forbiddenMethods: FORBIDDEN_METHODS });

    if (req.url === '/health') return json(req, res, 200, {
      ok: true, phase: PHASE, service: SERVICE_NAME, mode: state.mode, readonly: true,
      databaseConnectionAttempted: state.snapshot.databaseConnectionAttempted === true,
      writeExecuted: false, commitExecuted: false, transactionStarted: false, productionTouched: false,
      targetDatabase: state.mode === MODE_CONTROLLED ? 'staging' : 'none_mock'
    });

    if (req.url === '/api/crm/prospect-staging/readonly-snapshot') return json(req, res, 200, state.snapshot);
    if (req.url === '/api/crm/prospect-staging/readonly-evidence') return json(req, res, 200, state.evidence);
    return json(req, res, 404, { ok: false, phase: PHASE, error: 'Not Found', readonly: true });
  });
}

export async function startReadonlyApiServer({ host = process.env.ADEIN_API_BIND_HOST || '127.0.0.1', port = Number(process.env.ADEIN_API_PORT || 3091) } = {}) {
  if (isProductionSignal()) throw new Error('Abortado por señal de producción');
  if (host !== '127.0.0.1') throw new Error('Bind host inválido; solo 127.0.0.1 permitido');

  const gates = controlledGateStatus(host, port);
  const wantsControlled = gates.controlledEnabled;
  if (wantsControlled && process.env.ADEIN_DB_TARGET !== 'staging') throw new Error('Controlled mode requiere ADEIN_DB_TARGET=staging');
  if (wantsControlled && !gates.bindHostLocalOnly) throw new Error('Controlled mode requiere bind local 127.0.0.1');
  if (wantsControlled && !gates.portIsDefaultReadonly) throw new Error('Controlled mode requiere ADEIN_API_PORT=3091');

  let runtime = { mode: MODE_MOCK, snapshot: mockSnapshot, evidence: buildMockEvidence() };

  if (wantsControlled) {
    const controlledReady = gates.envFilePathConfigured && gates.envFileExists && gates.targetIsStaging && gates.readonlyApiGate && gates.bindHostLocalOnly && gates.portIsDefaultReadonly;
    if (controlledReady) {
      const snapshot = normalizeControlledPayload(await runControlledReadonlySnapshot({ phase: PHASE, mode: MODE_CONTROLLED }));
      runtime = {
        mode: MODE_CONTROLLED,
        snapshot,
        evidence: {
          ok: true, phase: PHASE, mode: MODE_CONTROLLED, readonly: true,
          verifiedNoTransaction: true, verifiedNoWrite: true, verifiedNoCommit: true,
          databaseConnectionAttempted: true, writeExecuted: false, commitExecuted: false, transactionStarted: false, productionTouched: false,
          targetDatabase: 'staging', missingTables: snapshot.missingTables, rowCounts: snapshot.rowCounts || {},
          blockedMethods: FORBIDDEN_METHODS, routes: ROUTES,
          controlledGatesValidated: true
        }
      };
    } else {
      throw new Error('Controlled mode incompleto: faltan gates exactos (ADEIN_DB_ENV_FILE existente, ADEIN_DB_READONLY_API=1, ADEIN_DB_TARGET=staging, ADEIN_API_BIND_HOST=127.0.0.1, ADEIN_API_PORT=3091)');
    }
  }

  const server = createReadonlyApiServer({ runtime });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  return { server, host, port, runtimeMode: runtime.mode };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { host, port, runtimeMode } = await startReadonlyApiServer();
    console.log(JSON.stringify({ ok: true, phase: PHASE, mode: runtimeMode, serverStarted: true, databaseConnectionAttempted: runtimeMode === MODE_CONTROLLED, readonly: true, writeExecuted: false, commitExecuted: false, transactionStarted: false, productionTouched: false, bindHost: host, port, routes: ROUTES }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, phase: PHASE, aborted: true, error: error?.message || String(error) }, null, 2));
    process.exit(1);
  }
}
