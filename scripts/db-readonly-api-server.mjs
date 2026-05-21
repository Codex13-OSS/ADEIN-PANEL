#!/usr/bin/env node
import http from 'node:http';

const SERVICE_NAME = 'adein-db-readonly-api';

function json(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}

function baseHealth() {
  return { ok: true, service: SERVICE_NAME, mode: 'read_only', writesEnabled: false };
}

export function createReadonlyApiServer() {
  return http.createServer(async (req, res) => {
    if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method Not Allowed', mode: 'read_only', writesEnabled: false });
    try {
      if (req.url === '/health') return json(res, 200, baseHealth());
      if (req.url === '/') {
        return json(res, 200, { ...baseHealth(), endpoints: ['GET /health', 'GET /', 'GET /api/db/health', 'GET /api/db/metrics', 'GET /api/db/snapshot'] });
      }
      if (req.url === '/api/db/health') {
        const { getDbHealthSnapshot } = await import('./lib/db-health.mjs');
        return json(res, 200, await getDbHealthSnapshot());
      }
      if (req.url === '/api/db/metrics') {
        const { getDbReadonlyMetrics } = await import('./lib/db-metrics.mjs');
        return json(res, 200, await getDbReadonlyMetrics());
      }
      if (req.url === '/api/db/snapshot') {
        const { getDbReadonlySnapshot } = await import('./lib/db-snapshot.mjs');
        return json(res, 200, await getDbReadonlySnapshot());
      }
      return json(res, 404, { ok: false, error: 'Not Found', mode: 'read_only', writesEnabled: false });
    } catch (error) {
      return json(res, 500, { ok: false, status: 'error', mode: 'read_only', writesEnabled: false, error: { name: error?.name ?? 'Error', message: error?.message ?? 'Unknown database error' } });
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
