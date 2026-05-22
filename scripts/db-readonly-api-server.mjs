#!/usr/bin/env node
import http from 'node:http';

const SERVICE_NAME = 'adein-db-readonly-api';
const ALLOWED_DEV_ORIGINS = new Set(['http://127.0.0.1:5173', 'http://localhost:5173']);

function buildCorsHeaders(req) {
  const origin = req.headers.origin;
  const headers = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };

  if (typeof origin === 'string' && ALLOWED_DEV_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

function json(req, res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...buildCorsHeaders(req),
  });
  res.end(JSON.stringify(body, null, 2));
}

function baseHealth() {
  return { ok: true, service: SERVICE_NAME, mode: 'read_only', writesEnabled: false };
}

export function createReadonlyApiServer() {
  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, buildCorsHeaders(req));
      res.end();
      return;
    }

    if (req.method !== 'GET') return json(req, res, 405, { ok: false, error: 'Method Not Allowed', mode: 'read_only', writesEnabled: false });
    try {
      if (req.url === '/health') return json(req, res, 200, baseHealth());
      if (req.url === '/') {
        return json(req, res, 200, { ...baseHealth(), endpoints: ['GET /health', 'GET /', 'GET /api/db/health', 'GET /api/db/metrics', 'GET /api/db/snapshot'] });
      }
      if (req.url === '/api/db/health') {
        const { getDbHealthSnapshot } = await import('./lib/db-health.mjs');
        return json(req, res, 200, await getDbHealthSnapshot());
      }
      if (req.url === '/api/db/metrics') {
        const { getDbReadonlyMetrics } = await import('./lib/db-metrics.mjs');
        return json(req, res, 200, await getDbReadonlyMetrics());
      }
      if (req.url === '/api/db/snapshot') {
        const { getDbReadonlySnapshot } = await import('./lib/db-snapshot.mjs');
        return json(req, res, 200, await getDbReadonlySnapshot());
      }
      return json(req, res, 404, { ok: false, error: 'Not Found', mode: 'read_only', writesEnabled: false });
    } catch (error) {
      return json(req, res, 500, { ok: false, status: 'error', mode: 'read_only', writesEnabled: false, error: { name: error?.name ?? 'Error', message: error?.message ?? 'Unknown database error' } });
    }
  });
}

export async function startReadonlyApiServer({ host = process.env.ADEIN_DB_API_HOST || '127.0.0.1', port = Number(process.env.ADEIN_DB_API_PORT || 3090) } = {}) {
  const server = createReadonlyApiServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  return { server, host, port };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startReadonlyApiServer()
    .then(({ host, port }) => {
      console.log(JSON.stringify({ ok: true, service: SERVICE_NAME, mode: 'read_only', writesEnabled: false, host, port }, null, 2));
    })
    .catch((error) => {
      console.error(JSON.stringify({ ok: false, status: 'error', mode: 'read_only', writesEnabled: false, error: { name: error?.name ?? 'Error', message: error?.message ?? 'Unknown database error' } }, null, 2));
      process.exitCode = 1;
    });
}
