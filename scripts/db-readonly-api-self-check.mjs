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
  try {
    body = await response.json();
  } catch {}
  return { status: response.status, body };
}

const checks = {};
let server;
let ok = false;

try {
  const started = await startReadonlyApiServer({ host, port });
  server = started.server;
  checks.api_starts = true;

  const health = await request('/health');
  checks.health_ok =
    health.status === 200 &&
    health.body?.ok === true &&
    health.body?.service === 'adein-db-readonly-api' &&
    health.body?.mode === 'read_only' &&
    health.body?.writesEnabled === false;

  const root = await request('/');
  checks.root_ok = root.status === 200 && Array.isArray(root.body?.endpoints) && root.body.endpoints.length > 0;

  const notFound = await request('/does-not-exist');
  checks.not_found_ok = notFound.status === 404;

  const postHealth = await request('/health', 'POST');
  const postSnapshot = await request('/api/db/snapshot', 'POST');
  checks.method_not_allowed_ok = postHealth.status === 405 && postSnapshot.status === 405;

  checks.no_writes_enabled = [health.body, root.body, notFound.body, postHealth.body, postSnapshot.body].every(
    (b) => b?.writesEnabled === false
  );

  if (hasDbEnv) {
    const dbHealth = await request('/api/db/health');
    const dbMetrics = await request('/api/db/metrics');
    const dbSnapshot = await request('/api/db/snapshot');

    checks.db_health_ok =
      dbHealth.status === 200 &&
      dbHealth.body?.ok === true &&
      dbHealth.body?.mode === 'read_only' &&
      dbHealth.body?.writesEnabled === false;

    checks.db_metrics_ok =
      dbMetrics.status === 200 &&
      dbMetrics.body?.ok === true &&
      dbMetrics.body?.mode === 'read_only' &&
      dbMetrics.body?.writesEnabled === false;

    checks.db_snapshot_summary_cards_ok = Boolean(dbSnapshot.body?.summaryCards);
    checks.db_snapshot_clients_card_ok = Boolean(dbSnapshot.body?.summaryCards?.clients) && Boolean(dbSnapshot.body?.summaryCards?.lots) && Boolean(dbSnapshot.body?.summaryCards?.contracts);
    checks.db_snapshot_collection_cards_ok = Boolean(dbSnapshot.body?.summaryCards?.expectedCollection) && Boolean(dbSnapshot.body?.summaryCards?.pendingCollection);

    checks.db_snapshot_ok =
      dbSnapshot.status === 200 &&
      dbSnapshot.body?.ok === true &&
      dbSnapshot.body?.mode === 'read_only' &&
      dbSnapshot.body?.writesEnabled === false &&
      checks.db_snapshot_summary_cards_ok === true &&
      checks.db_snapshot_clients_card_ok === true &&
      checks.db_snapshot_collection_cards_ok === true;

    checks.no_writes_enabled =
      checks.no_writes_enabled && [dbHealth.body, dbMetrics.body, dbSnapshot.body].every((b) => b?.writesEnabled === false);
  } else {
    checks.db_health_skipped = true;
    checks.db_metrics_skipped = true;
    checks.db_snapshot_skipped = true;
  }

  const requiredBaseChecks =
    checks.api_starts === true &&
    checks.health_ok === true &&
    checks.root_ok === true &&
    checks.not_found_ok === true &&
    checks.method_not_allowed_ok === true &&
    checks.no_writes_enabled === true;

  const dbChecksOk = hasDbEnv
    ? checks.db_health_ok === true && checks.db_metrics_ok === true && checks.db_snapshot_ok === true
    : checks.db_health_skipped === true && checks.db_metrics_skipped === true && checks.db_snapshot_skipped === true;

  ok = requiredBaseChecks && dbChecksOk;
} catch {
  checks.api_starts = false;
  ok = false;
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
}

console.log(JSON.stringify({ ok, mode: 'read_only', writesEnabled: false, hasDbEnv, checks }, null, 2));
process.exit(ok ? 0 : 1);
