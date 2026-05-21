#!/usr/bin/env node
import { startReadonlyApiServer } from './db-readonly-api-server.mjs';
const REQUIRED_DB_ENV = ['ADEIN_DB_HOST', 'ADEIN_DB_PORT', 'ADEIN_DB_NAME', 'ADEIN_DB_USER', 'ADEIN_DB_PASSWORD'];

const host = '127.0.0.1';
const port = 3091;
const baseUrl = `http://${host}:${port}`;

const hasDbEnv = REQUIRED_DB_ENV.every((k) => Boolean(process.env[k]));

async function request(path, method = 'GET') {
  const response = await fetch(`${baseUrl}${path}`, { method });
  let body = null;
  try { body = await response.json(); } catch {}
  return { status: response.status, body };
}

const checks = {};
let failed = false;
let server;

try {
  const started = await startReadonlyApiServer({ host, port });
  server = started.server;
  checks.api_starts = true;

  const health = await request('/health');
  checks.health_ok = health.status === 200 && health.body?.ok === true && health.body?.service === 'adein-db-readonly-api' && health.body?.mode === 'read_only' && health.body?.writesEnabled === false;

  const root = await request('/');
  checks.root_ok = root.status === 200 && Array.isArray(root.body?.endpoints) && root.body.endpoints.length > 0;

  const notFound = await request('/does-not-exist');
  checks.not_found_ok = notFound.status === 404;

  const postHealth = await request('/health', 'POST');
  const postSnapshot = await request('/api/db/snapshot', 'POST');
  checks.method_not_allowed_ok = postHealth.status === 405 && postSnapshot.status === 405;

  checks.no_writes_enabled = [health.body, root.body, postHealth.body, postSnapshot.body, notFound.body].every((b) => b?.writesEnabled === false);

  if (hasDbEnv) {
    const dbHealth = await request('/api/db/health');
    const dbMetrics = await request('/api/db/metrics');
    const dbSnapshot = await request('/api/db/snapshot');
    checks.db_health_ok = dbHealth.status === 200 && dbHealth.body?.ok === true && dbHealth.body?.mode === 'read_only' && dbHealth.body?.writesEnabled === false;
    checks.db_metrics_ok = dbMetrics.status === 200 && dbMetrics.body?.ok === true && dbMetrics.body?.mode === 'read_only' && dbMetrics.body?.writesEnabled === false;
    checks.db_snapshot_ok = dbSnapshot.status === 200 && dbSnapshot.body?.ok === true && dbSnapshot.body?.mode === 'read_only' && dbSnapshot.body?.writesEnabled === false && dbSnapshot.body?.summaryCards;
    checks.no_writes_enabled = checks.no_writes_enabled && [dbHealth.body, dbMetrics.body, dbSnapshot.body].every((b) => b?.writesEnabled === false);
  } else {
    checks.db_health_skipped = true;
    checks.db_metrics_skipped = true;
    checks.db_snapshot_skipped = true;
  }

  const required = ['api_starts', 'health_ok', 'root_ok', 'not_found_ok', 'method_not_allowed_ok', 'no_writes_enabled'];
  failed = required.some((k) => checks[k] !== true);
  if (hasDbEnv) failed = failed || checks.db_health_ok !== true || checks.db_metrics_ok !== true || checks.db_snapshot_ok !== true;
} catch {
  checks.api_starts = false;
  failed = true;
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
}

console.log(JSON.stringify({ ok: !failed, mode: 'read_only', writesEnabled: false, hasDbEnv, checks }, null, 2));
process.exit(failed ? 1 : 0);
