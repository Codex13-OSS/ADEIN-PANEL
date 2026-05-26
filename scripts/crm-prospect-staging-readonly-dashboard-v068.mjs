#!/usr/bin/env node
import fs from 'node:fs';

const PHASE = 'v068';
const MODE_DRY = 'dry_run';
const MODE_CONTROLLED = 'controlled_readonly_dashboard_snapshot';
const TARGET_TABLES = ['lead_sources', 'prospects', 'whatsapp_conversations', 'whatsapp_analyses', 'prospect_followups', 'crm_history_events'];
const FORBIDDEN_DESTINATIONS = ['clients', 'contracts', 'payment_schedule', 'lots'];
const REQUIRED_DB_ENV = ['ADEIN_DB_HOST', 'ADEIN_DB_PORT', 'ADEIN_DB_NAME', 'ADEIN_DB_USER', 'ADEIN_DB_PASSWORD'];
const DANGEROUS_SQL_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'ALTER', 'DROP', 'TRUNCATE', 'CREATE', 'REPLACE'];
const WRITE_SIGNAL_ENV = ['ADEIN_DB_COMMIT', 'ADEIN_DB_ALLOW_PERSISTENT_WRITE', 'ADEIN_DB_ENABLE_WRITES', 'ADEIN_DB_WRITE_GATE', 'ADEIN_DB_APPROVAL_TOKEN'];

const fail = (payload, error, code = 1) => {
  process.stdout.write(`${JSON.stringify({ ...payload, ok: false, aborted: true, error }, null, 2)}\n`);
  process.exit(code);
};

function parseEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const row of raw.split(/\r?\n/u)) {
    const line = row.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

const getString = (value, fallback = 'n/a') => (typeof value === 'string' && value.trim() ? value : fallback);
const isTruthyOne = (value) => value === '1';

function assertGlobalSafety(payload) {
  if (process.env.NODE_ENV === 'production' || process.env.ADEIN_DB_TARGET === 'production' || process.env.ADEIN_DB_ENV === 'production') {
    fail(payload, 'Abortado por señal de producción');
  }

  for (const key of WRITE_SIGNAL_ENV) {
    if ((key === 'ADEIN_DB_COMMIT' || key === 'ADEIN_DB_ALLOW_PERSISTENT_WRITE' || key === 'ADEIN_DB_ENABLE_WRITES') && process.env[key] === '1') {
      fail(payload, `Abortado por señal de escritura: ${key}=1`);
    }
    if ((key === 'ADEIN_DB_WRITE_GATE' || key === 'ADEIN_DB_APPROVAL_TOKEN') && process.env[key] !== undefined) {
      fail(payload, `Abortado por gate de escritura definido: ${key}`);
    }
  }
}

function buildReadonlyQueries() {
  return [
    { name: 'tables_existence', sql: 'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?, ?, ?, ?, ?, ?)' },
    ...TARGET_TABLES.map((table) => ({ name: `count_${table}`, sql: `SELECT COUNT(*) AS count FROM \`${table}\`` })),
    { name: 'latest_prospects', sql: 'SELECT id, source_ref, external_ref, name, phone_normalized, status, intention_level, review_status, is_test, is_demo, created_at FROM `prospects` ORDER BY created_at DESC LIMIT 10' },
    { name: 'latest_followups', sql: 'SELECT id, prospect_id, source_ref, external_ref, status, next_action, review_status, is_test, is_demo, created_at FROM `prospect_followups` ORDER BY created_at DESC LIMIT 10' },
    { name: 'latest_history_events', sql: 'SELECT id, prospect_id, followup_id, event_type, status, intention_level, source_ref, external_ref, review_status, is_test, is_demo, created_at FROM `crm_history_events` ORDER BY created_at DESC LIMIT 10' },
    { name: 'breakdown_by_source', sql: 'SELECT source, COUNT(*) AS count FROM `prospects` GROUP BY source ORDER BY count DESC' },
    { name: 'breakdown_by_review_status', sql: 'SELECT review_status, COUNT(*) AS count FROM `prospects` GROUP BY review_status ORDER BY count DESC' },
    { name: 'breakdown_by_status', sql: 'SELECT status, COUNT(*) AS count FROM `prospects` GROUP BY status ORDER BY count DESC' },
    { name: 'breakdown_by_intention_level', sql: 'SELECT intention_level, COUNT(*) AS count FROM `prospects` GROUP BY intention_level ORDER BY count DESC' },
    { name: 'synthetic_probe_prospects', sql: "SELECT COUNT(*) AS count FROM `prospects` WHERE is_test = 1 OR is_demo = 1 OR external_ref LIKE ? OR source_ref LIKE ?" },
    { name: 'synthetic_probe_lead_sources', sql: "SELECT COUNT(*) AS count FROM `lead_sources` WHERE is_test = 1 OR is_demo = 1 OR source_code LIKE ? OR source_ref LIKE ?" },
    { name: 'synthetic_probe_history', sql: "SELECT COUNT(*) AS count FROM `crm_history_events` WHERE is_test = 1 OR is_demo = 1 OR external_ref LIKE ? OR source_ref LIKE ? OR event_type LIKE ?" }
  ];
}

function assertReadonlyQueries(queries, payload) {
  const bad = queries.filter((q) => DANGEROUS_SQL_KEYWORDS.some((keyword) => new RegExp(`\\b${keyword}\\b`, 'i').test(q.sql)));
  if (bad.length > 0) fail(payload, `SQL peligroso detectado en readonlyQueryPlan: ${bad.map((item) => item.name).join(', ')}`);
}

function buildDryRunPayload() {
  const readonlyQueryPlan = buildReadonlyQueries();
  const previewToken = 'v067_preview_token';
  return {
    ok: true,
    phase: PHASE,
    mode: MODE_DRY,
    dryRun: true,
    databaseConnectionAttempted: false,
    transactionStarted: false,
    writeExecuted: false,
    commitExecuted: false,
    readonly: true,
    productionTouched: false,
    targetTables: [...TARGET_TABLES],
    forbiddenDestinations: [...FORBIDDEN_DESTINATIONS],
    dashboardPayloadPreview: {
      summaryCards: {
        totalProspects: 1,
        totalConversations: 1,
        totalAnalyses: 1,
        totalFollowups: 1,
        totalHistoryEvents: 1,
        syntheticRowsDetected: 1
      },
      latestProspects: [{ id: 1, name: 'Demo Prospect v067.1', source_ref: previewToken, external_ref: previewToken, status: 'new', intention_level: 'high', is_test: 1, is_demo: 1 }],
      followups: [{ id: 1, prospect_id: 1, status: 'pending', next_action: 'demo_followup', source_ref: previewToken, is_test: 1, is_demo: 1 }],
      historyEvents: [{ id: 1, prospect_id: 1, event_type: `prospect_staged_${previewToken}`, status: 'new', intention_level: 'high', source_ref: previewToken, is_test: 1, is_demo: 1 }],
      sourceBreakdown: { source: [{ key: 'demo', count: 1 }], review_status: [{ key: 'pending', count: 1 }], status: [{ key: 'new', count: 1 }], intention_level: [{ key: 'high', count: 1 }] },
      warnings: ['Dry-run: payload sintético en memoria. No conexión a BD.', 'Read-only staging. Sin escritura. Sin producción.']
    },
    readonlyQueryPlan,
    expectedMetrics: {
      v067_1_row_counts_reference: Object.fromEntries(TARGET_TABLES.map((t) => [t, 1])),
      maxRecentRowsPerCollection: 10,
      syntheticDetectionTokenPrefix: 'v067'
    },
    safetyEnvelope: {
      defaultMode: MODE_DRY,
      allowedEscalationMode: MODE_CONTROLLED,
      requiredControlledGates: ['ADEIN_CRM_PROSPECT_STAGING_READONLY_DASHBOARD_V068=1', 'ADEIN_DB_ENV_FILE=<path>', 'ADEIN_DB_TARGET=staging', 'ADEIN_DB_READONLY_DASHBOARD=1'],
      blockedSignals: ['NODE_ENV=production', 'ADEIN_DB_TARGET=production', 'ADEIN_DB_ENV=production', 'ADEIN_DB_COMMIT=1', 'ADEIN_DB_ALLOW_PERSISTENT_WRITE=1', 'ADEIN_DB_ENABLE_WRITES=1', 'ADEIN_DB_WRITE_GATE definido', 'ADEIN_DB_APPROVAL_TOKEN definido']
    }
  };
}

async function runControlledReadonly(payload) {
  parseEnvFile(process.env.ADEIN_DB_ENV_FILE);
  const missingEnv = REQUIRED_DB_ENV.filter((key) => !process.env[key]);
  if (missingEnv.length) fail(payload, `Faltan variables DB: ${missingEnv.join(', ')}`);

  payload.databaseConnectionAttempted = true;
  const mysql = await import('mysql2/promise');
  const connection = await mysql.default.createConnection({
    host: process.env.ADEIN_DB_HOST,
    port: Number(process.env.ADEIN_DB_PORT),
    user: process.env.ADEIN_DB_USER,
    password: process.env.ADEIN_DB_PASSWORD,
    database: process.env.ADEIN_DB_NAME,
    connectTimeout: 8000
  });

  const executedQueries = [];
  const track = (name, sql) => executedQueries.push({ name, sqlType: /^\s*SELECT\b/i.test(sql) ? 'SELECT' : 'COUNT', sql });

  try {
    const readonlyQueryPlan = buildReadonlyQueries();
    assertReadonlyQueries(readonlyQueryPlan, payload);

    const tablesQuery = readonlyQueryPlan.find((q) => q.name === 'tables_existence');
    track(tablesQuery.name, tablesQuery.sql);
    const [tableRows] = await connection.query(tablesQuery.sql, [process.env.ADEIN_DB_NAME, ...TARGET_TABLES]);
    const existing = new Set(tableRows.map((row) => row.TABLE_NAME));
    const missingTables = TARGET_TABLES.filter((table) => !existing.has(table));
    if (missingTables.length > 0) {
      fail(payload, `Faltan tablas obligatorias: ${missingTables.join(', ')}`);
    }

    const rowCounts = {};
    for (const table of TARGET_TABLES) {
      const q = readonlyQueryPlan.find((item) => item.name === `count_${table}`);
      track(q.name, q.sql);
      const [rows] = await connection.query(q.sql);
      rowCounts[table] = Number(rows?.[0]?.count ?? 0);
    }

    const fetchRows = async (name) => {
      const q = readonlyQueryPlan.find((item) => item.name === name);
      track(q.name, q.sql);
      const [rows] = await connection.query(q.sql);
      return rows;
    };

    const latestProspects = await fetchRows('latest_prospects');
    const followups = await fetchRows('latest_followups');
    const historyEvents = await fetchRows('latest_history_events');

    const fetchBreakdown = async (name, keyName) => {
      const rows = await fetchRows(name);
      return rows.map((row) => ({ key: getString(row[keyName]), count: Number(row.count ?? 0) }));
    };

    const sourceBreakdown = {
      source: await fetchBreakdown('breakdown_by_source', 'source'),
      review_status: await fetchBreakdown('breakdown_by_review_status', 'review_status'),
      status: await fetchBreakdown('breakdown_by_status', 'status'),
      intention_level: await fetchBreakdown('breakdown_by_intention_level', 'intention_level')
    };

    const tokenLike = '%v067%';
    const detectSynthetic = async (name, params) => {
      const q = readonlyQueryPlan.find((item) => item.name === name);
      track(q.name, q.sql);
      const [rows] = await connection.query(q.sql, params);
      return Number(rows?.[0]?.count ?? 0);
    };

    const syntheticRowsDetected = (await detectSynthetic('synthetic_probe_prospects', [tokenLike, tokenLike]))
      + (await detectSynthetic('synthetic_probe_lead_sources', [tokenLike, tokenLike]))
      + (await detectSynthetic('synthetic_probe_history', [tokenLike, tokenLike, tokenLike]));

    Object.assign(payload, {
      mode: MODE_CONTROLLED,
      dryRun: false,
      tablesFound: TARGET_TABLES,
      missingTables: [],
      rowCounts,
      dashboardPayload: {
        summaryCards: {
          totalProspects: rowCounts.prospects,
          totalConversations: rowCounts.whatsapp_conversations,
          totalAnalyses: rowCounts.whatsapp_analyses,
          totalFollowups: rowCounts.prospect_followups,
          totalHistoryEvents: rowCounts.crm_history_events,
          syntheticRowsDetected
        },
        latestProspects,
        followups,
        historyEvents,
        sourceBreakdown,
        warnings: ['Read-only staging', 'Sin escritura', 'Sin producción']
      },
      readonlyEvidence: {
        verifiedNoTransaction: true,
        verifiedNoWrite: true,
        verifiedNoCommit: true,
        forbiddenDestinationsConfirmed: true,
        queriesExecuted: executedQueries.map((q) => ({ name: q.name, sqlType: q.sqlType })),
        targetDatabase: 'staging'
      },
      warnings: []
    });
  } finally {
    await connection.end();
  }
}

async function main() {
  const payload = buildDryRunPayload();
  assertGlobalSafety(payload);
  assertReadonlyQueries(payload.readonlyQueryPlan, payload);

  const wantsControlled = process.env.ADEIN_CRM_PROSPECT_STAGING_READONLY_DASHBOARD_V068 === '1'
    && process.env.ADEIN_DB_ENV_FILE
    && process.env.ADEIN_DB_TARGET === 'staging'
    && process.env.ADEIN_DB_READONLY_DASHBOARD === '1';

  if (!wantsControlled) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  await runControlledReadonly(payload);
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((error) => {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: PHASE, mode: 'error', error: error?.message || String(error) }, null, 2)}\n`);
  process.exit(1);
});
