#!/usr/bin/env node
import fs from 'node:fs';
import { resolve } from 'node:path';

const PHASE = 'v065';
const MODE_DRY = 'dry_run';
const MODE_ROLLBACK = 'controlled_rollback_only_staging';
const REQUIRED_GATE = 'ROLLBACK_ONLY_V065';
const TARGET_TABLES = ['lead_sources', 'prospects', 'whatsapp_conversations', 'whatsapp_analyses', 'prospect_followups', 'crm_history_events'];
const FORBIDDEN_DESTINATIONS = ['clients', 'contracts', 'payment_schedule', 'lots'];
const REQUIRED_DB_ENV = ['ADEIN_DB_HOST', 'ADEIN_DB_PORT', 'ADEIN_DB_NAME', 'ADEIN_DB_USER', 'ADEIN_DB_PASSWORD'];

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

function makeToken() {
  return `v065_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function basePayload() {
  const token = makeToken();
  const syntheticPayloadPreview = {
    token,
    source_code: `demo_whatsapp_${token}`,
    source_ref: `source_ref_${token}`,
    external_ref: `external_ref_${token}`,
    name: `Demo Prospect ${token}`,
    phone_original: '+52 55 1000 0000',
    phone_normalized: '525510000000',
    event_type: `prospect_staged_${token}`
  };

  return {
    ok: true,
    phase: PHASE,
    mode: MODE_DRY,
    dryRun: true,
    databaseConnectionAttempted: false,
    transactionStarted: false,
    rollbackExecuted: false,
    commitExecuted: false,
    persistentWriteExecuted: false,
    syntheticOnly: true,
    targetTables: [...TARGET_TABLES],
    syntheticPayloadPreview,
    insertionPlan: [
      { table: 'lead_sources', relation: 'root synthetic source' },
      { table: 'prospects', relation: 'references lead_sources.id' },
      { table: 'whatsapp_conversations', relation: 'references prospects.id' },
      { table: 'whatsapp_analyses', relation: 'references prospects.id and whatsapp_conversations.id' },
      { table: 'prospect_followups', relation: 'references prospects.id' },
      { table: 'crm_history_events', relation: 'references prospect/conversation/analysis/followup ids' }
    ],
    verificationPlan: [
      'Validate required gates and reject dangerous env.',
      'Verify required target tables exist in INFORMATION_SCHEMA.',
      'Read row counts before transaction.',
      'Insert exactly one synthetic relational set.',
      'Verify inserts inside transaction by rollback token.',
      'Execute mandatory ROLLBACK.',
      'Verify row counts after rollback equal row counts before.'
    ],
    safetyEnvelope: {
      defaultMode: MODE_DRY,
      requiresExplicitGates: [
        'ADEIN_CRM_PROSPECT_STAGING_SYNTHETIC_WRITE_V065=1',
        'ADEIN_DB_ENV_FILE=<path>',
        'ADEIN_DB_TARGET=staging',
        `ADEIN_DB_WRITE_GATE=${REQUIRED_GATE}`
      ],
      blockedSignals: [
        'NODE_ENV=production',
        'ADEIN_DB_TARGET=production',
        'ADEIN_DB_ENV=production',
        'ADEIN_DB_COMMIT=1',
        'ADEIN_DB_ALLOW_PERSISTENT_WRITE=1',
        'ADEIN_DB_ENABLE_WRITES=1'
      ],
      forbiddenDestinations: [...FORBIDDEN_DESTINATIONS],
      maxWriteMode: 'rollback_only'
    }
  };
}

function fail(payload, error, code = 1) {
  process.stdout.write(`${JSON.stringify({ ...payload, ok: false, error }, null, 2)}\n`);
  process.exit(code);
}

function ensureSafeEnv(payload) {
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.ADEIN_DB_TARGET === 'production' ||
    process.env.ADEIN_DB_ENV === 'production' ||
    process.env.ADEIN_DB_COMMIT === '1' ||
    process.env.ADEIN_DB_ALLOW_PERSISTENT_WRITE === '1' ||
    process.env.ADEIN_DB_ENABLE_WRITES === '1'
  ) fail(payload, 'Abortado por señales de producción/persistencia peligrosa');

  if (process.env.ADEIN_DB_WRITE_GATE && process.env.ADEIN_DB_WRITE_GATE !== REQUIRED_GATE) {
    fail(payload, `ADEIN_DB_WRITE_GATE debe ser exactamente ${REQUIRED_GATE}`);
  }
}

async function main() {
  const payload = basePayload();
  ensureSafeEnv(payload);

  const rollbackEnabled = process.env.ADEIN_CRM_PROSPECT_STAGING_SYNTHETIC_WRITE_V065 === '1';
  if (!rollbackEnabled) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  payload.mode = MODE_ROLLBACK;
  payload.dryRun = false;

  if (process.env.ADEIN_DB_TARGET !== 'staging') fail(payload, 'ADEIN_DB_TARGET debe ser staging');
  if (process.env.ADEIN_DB_WRITE_GATE !== REQUIRED_GATE) fail(payload, `ADEIN_DB_WRITE_GATE debe ser exactamente ${REQUIRED_GATE}`);

  const envFile = process.env.ADEIN_DB_ENV_FILE;
  if (!envFile || !fs.existsSync(envFile)) fail(payload, 'ADEIN_DB_ENV_FILE faltante o inexistente');

  parseEnvFile(envFile);
  const missingDbVars = REQUIRED_DB_ENV.filter((k) => !process.env[k]);
  if (missingDbVars.length > 0) fail(payload, `Faltan variables DB: ${missingDbVars.join(', ')}`);

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

  try {
    const forbiddenFound = FORBIDDEN_DESTINATIONS.filter((t) => TARGET_TABLES.includes(t));
    if (forbiddenFound.length > 0) fail(payload, `Destino prohibido detectado: ${forbiddenFound.join(', ')}`);

    const [tableRows] = await connection.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${TARGET_TABLES.map(() => '?').join(',')})`,
      [process.env.ADEIN_DB_NAME, ...TARGET_TABLES]
    );
    const existing = new Set(tableRows.map((r) => r.TABLE_NAME));
    const missingTables = TARGET_TABLES.filter((t) => !existing.has(t));
    if (missingTables.length > 0) fail(payload, `Faltan tablas prospect staging: ${missingTables.join(', ')}`);

    const rowCountsBefore = {};
    for (const table of TARGET_TABLES) {
      const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      rowCountsBefore[table] = Number(rows?.[0]?.count ?? -1);
    }

    const token = payload.syntheticPayloadPreview.token;

    await connection.beginTransaction();
    payload.transactionStarted = true;

    const [leadRes] = await connection.execute(
      'INSERT INTO `lead_sources` (source_code, source_ref, environment, is_test, is_demo, review_status, raw_payload_json, normalized_payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [`demo_whatsapp_${token}`, `source_ref_${token}`, 'staging', 1, 1, 'pending', JSON.stringify({ token }), JSON.stringify({ token })]
    );

    const [prospectRes] = await connection.execute(
      'INSERT INTO `prospects` (external_ref, source_ref, source, environment, is_test, is_demo, review_status, lead_source_id, name, phone_original, phone_normalized, property_interest, status, intention_level, next_action, raw_payload_json, normalized_payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [`external_ref_${token}`, `source_ref_${token}`, 'demo', 'staging', 1, 1, 'pending', leadRes.insertId, `Demo Prospect ${token}`, '+52 55 1000 0000', '525510000000', `Lote demo ${token}`, 'new', 'high', `followup_${token}`, JSON.stringify({ token }), JSON.stringify({ token })]
    );

    const [convRes] = await connection.execute(
      'INSERT INTO `whatsapp_conversations` (external_ref, source_ref, prospect_id, source, environment, is_test, is_demo, review_status, phone_original, phone_normalized, raw_payload_json, normalized_payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [`conv_ext_${token}`, `source_ref_${token}`, prospectRes.insertId, 'demo', 'staging', 1, 1, 'pending', '+52 55 1000 0000', '525510000000', JSON.stringify({ token }), JSON.stringify({ token })]
    );

    const [analysisRes] = await connection.execute(
      'INSERT INTO `whatsapp_analyses` (external_ref, source_ref, prospect_id, conversation_id, source, environment, is_test, is_demo, review_status, intention_level, next_action, raw_payload_json, normalized_payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [`analysis_ext_${token}`, `source_ref_${token}`, prospectRes.insertId, convRes.insertId, 'demo', 'staging', 1, 1, 'pending', 'high', `followup_${token}`, JSON.stringify({ token }), JSON.stringify({ token })]
    );

    const [followRes] = await connection.execute(
      'INSERT INTO `prospect_followups` (external_ref, source_ref, prospect_id, source, environment, is_test, is_demo, review_status, status, next_action, raw_payload_json, normalized_payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [`follow_ext_${token}`, `source_ref_${token}`, prospectRes.insertId, 'demo', 'staging', 1, 1, 'pending', 'pending', `followup_${token}`, JSON.stringify({ token }), JSON.stringify({ token })]
    );

    const [historyRes] = await connection.execute(
      'INSERT INTO `crm_history_events` (external_ref, source_ref, prospect_id, followup_id, conversation_id, analysis_id, source, environment, is_test, is_demo, review_status, event_type, status, intention_level, next_action, raw_payload_json, normalized_payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [`history_ext_${token}`, `source_ref_${token}`, prospectRes.insertId, followRes.insertId, convRes.insertId, analysisRes.insertId, 'demo', 'staging', 1, 1, 'pending', `prospect_staged_${token}`, 'new', 'high', `followup_${token}`, JSON.stringify({ token }), JSON.stringify({ token })]
    );

    payload.insertsAttempted = 6;
    payload.insertedIds = {
      lead_source_id: leadRes.insertId,
      prospect_id: prospectRes.insertId,
      conversation_id: convRes.insertId,
      analysis_id: analysisRes.insertId,
      followup_id: followRes.insertId,
      history_event_id: historyRes.insertId
    };

    const rowCountsInsideTransaction = {};
    for (const table of TARGET_TABLES) {
      const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      rowCountsInsideTransaction[table] = Number(rows?.[0]?.count ?? -1);
    }

    const [verifyRows] = await connection.query(
      'SELECT COUNT(*) AS count FROM `crm_history_events` WHERE event_type = ?',
      [`prospect_staged_${token}`]
    );
    if (Number(verifyRows?.[0]?.count ?? 0) !== 1) fail(payload, 'No se verificó el set sintético dentro de la transacción');

    await connection.rollback();
    payload.rollbackExecuted = true;

    const rowCountsAfterRollback = {};
    for (const table of TARGET_TABLES) {
      const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      rowCountsAfterRollback[table] = Number(rows?.[0]?.count ?? -1);
    }

    const postRollbackVerified = TARGET_TABLES.every((t) => rowCountsBefore[t] === rowCountsAfterRollback[t]);
    if (!postRollbackVerified) fail(payload, 'Row counts post-rollback no coinciden con row counts before', true);

    Object.assign(payload, {
      rowCountsBefore,
      rowCountsInsideTransaction,
      rowCountsAfterRollback,
      postRollbackVerified,
      syntheticOnly: true,
      commitExecuted: false,
      persistentWriteExecuted: false
    });

    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: PHASE, mode: 'error', error: error?.message || String(error) }, null, 2)}\n`);
  process.exit(1);
});
