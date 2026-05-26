#!/usr/bin/env node
import fs from 'node:fs';

const PHASE = 'v067';
const MODE_DRY = 'dry_run';
const MODE_READONLY = 'controlled_readonly_precommit';
const MODE_COMMIT = 'controlled_persistent_commit_staging';
const COMMIT_GATE = 'PERSISTENT_COMMIT_V067';
const APPROVAL_TOKEN = 'APPROVE_SYNTHETIC_PERSISTENT_WRITE_V067';
const TARGET_TABLES = ['lead_sources', 'prospects', 'whatsapp_conversations', 'whatsapp_analyses', 'prospect_followups', 'crm_history_events'];
const FORBIDDEN_DESTINATIONS = ['clients', 'contracts', 'payment_schedule', 'lots'];
const REQUIRED_DB_ENV = ['ADEIN_DB_HOST', 'ADEIN_DB_PORT', 'ADEIN_DB_NAME', 'ADEIN_DB_USER', 'ADEIN_DB_PASSWORD'];

function parseEnvFile(filePath) { const raw = fs.readFileSync(filePath, 'utf8'); for (const row of raw.split(/\r?\n/u)) { const line = row.trim(); if (!line || line.startsWith('#')) continue; const idx = line.indexOf('='); if (idx <= 0) continue; const key = line.slice(0, idx).trim(); let value = line.slice(idx + 1).trim(); if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1); process.env[key] = value; } }
const makeToken = () => `v067_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const fail = (payload, error, code = 1) => { process.stdout.write(`${JSON.stringify({ ...payload, ok: false, aborted: true, error }, null, 2)}\n`); process.exit(code); };

function buildPayload() {
  const token = makeToken();
  return {
    ok: true, phase: PHASE, mode: MODE_DRY, dryRun: true, databaseConnectionAttempted: false, transactionStarted: false, rollbackExecuted: false, commitExecuted: false, persistentWriteExecuted: false,
    syntheticOnly: true, realProspectsUsed: false, productionTouched: false, targetTables: [...TARGET_TABLES], forbiddenDestinations: [...FORBIDDEN_DESTINATIONS],
    syntheticPayloadPreview: { token, source_code: `demo_whatsapp_${token}`, source_ref: `source_ref_${token}`, external_ref: `external_ref_${token}`, event_type: `prospect_staged_${token}` },
    persistentWritePlan: TARGET_TABLES.map((table) => ({ table, inserts: 1 })),
    requiredCommitGates: ['ADEIN_CRM_PROSPECT_STAGING_SYNTHETIC_PERSISTENT_WRITE_V067=1', 'ADEIN_DB_ENV_FILE=<path>', 'ADEIN_DB_TARGET=staging', `ADEIN_DB_WRITE_GATE=${COMMIT_GATE}`, `ADEIN_DB_APPROVAL_TOKEN=${APPROVAL_TOKEN}`, 'ADEIN_DB_SYNTHETIC_ONLY=1', 'ADEIN_DB_PRODUCTION_TOUCHED=0'],
    requiredPreCommitChecks: ['6 tablas existen en staging', 'row counts baseline', 'forbidden destinations fuera de target', 'payload sintético relacional único por token'],
    requiredPostCommitEvidence: ['+1 row count en cada tabla target', 'verificación por token en columnas reales de 6 tablas', 'insertedIds y token auditables'],
    rollbackPlanByToken: { strategy: 'manual_compensating_delete_by_token', token, sequence: ['crm_history_events', 'prospect_followups', 'whatsapp_analyses', 'whatsapp_conversations', 'prospects', 'lead_sources'] },
    safetyEnvelope: { defaultMode: MODE_DRY, maxWriteMode: MODE_COMMIT, blockedSignals: ['NODE_ENV=production', 'ADEIN_DB_TARGET=production', 'ADEIN_DB_ENV=production'] }
  };
}

function validateSafety(payload) {
  const commitIntent = process.env.ADEIN_DB_COMMIT === '1' || process.env.ADEIN_DB_ALLOW_PERSISTENT_WRITE === '1' || process.env.ADEIN_DB_ENABLE_WRITES === '1';
  if (process.env.NODE_ENV === 'production' || process.env.ADEIN_DB_TARGET === 'production' || process.env.ADEIN_DB_ENV === 'production') fail(payload, 'Abortado por señal de producción');
  if (commitIntent && !(process.env.ADEIN_DB_WRITE_GATE === COMMIT_GATE && process.env.ADEIN_DB_APPROVAL_TOKEN === APPROVAL_TOKEN && process.env.ADEIN_DB_SYNTHETIC_ONLY === '1' && process.env.ADEIN_DB_PRODUCTION_TOUCHED === '0' && process.env.ADEIN_DB_TARGET === 'staging' && process.env.ADEIN_CRM_PROSPECT_STAGING_SYNTHETIC_PERSISTENT_WRITE_V067 === '1' && process.env.ADEIN_DB_ENV_FILE)) fail(payload, 'Intento de write/commit sin gates exactos v067');
}

async function main() {
  const payload = buildPayload();
  validateSafety(payload);
  const wantsReadonly = process.env.ADEIN_CRM_PROSPECT_STAGING_SYNTHETIC_PERSISTENT_WRITE_V067 === '1' && process.env.ADEIN_DB_ENV_FILE && process.env.ADEIN_DB_TARGET === 'staging' && process.env.ADEIN_DB_READONLY_PRECOMMIT === '1';
  const wantsCommit = process.env.ADEIN_CRM_PROSPECT_STAGING_SYNTHETIC_PERSISTENT_WRITE_V067 === '1' && process.env.ADEIN_DB_ENV_FILE && process.env.ADEIN_DB_TARGET === 'staging' && process.env.ADEIN_DB_WRITE_GATE === COMMIT_GATE && process.env.ADEIN_DB_APPROVAL_TOKEN === APPROVAL_TOKEN && process.env.ADEIN_DB_SYNTHETIC_ONLY === '1' && process.env.ADEIN_DB_PRODUCTION_TOUCHED === '0';
  if (!wantsReadonly && !wantsCommit) return process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);

  parseEnvFile(process.env.ADEIN_DB_ENV_FILE);
  const missing = REQUIRED_DB_ENV.filter((k) => !process.env[k]);
  if (missing.length) fail(payload, `Faltan variables DB: ${missing.join(', ')}`);
  payload.databaseConnectionAttempted = true;

  const mysql = await import('mysql2/promise');
  const connection = await mysql.default.createConnection({ host: process.env.ADEIN_DB_HOST, port: Number(process.env.ADEIN_DB_PORT), user: process.env.ADEIN_DB_USER, password: process.env.ADEIN_DB_PASSWORD, database: process.env.ADEIN_DB_NAME, connectTimeout: 8000 });
  try {
    const forbiddenFound = FORBIDDEN_DESTINATIONS.filter((t) => TARGET_TABLES.includes(t)); if (forbiddenFound.length) fail(payload, `Destino prohibido detectado: ${forbiddenFound.join(',')}`);
    const [tableRows] = await connection.query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${TARGET_TABLES.map(() => '?').join(',')})`, [process.env.ADEIN_DB_NAME, ...TARGET_TABLES]);
    const existing = new Set(tableRows.map((r) => r.TABLE_NAME));
    const missingTables = TARGET_TABLES.filter((t) => !existing.has(t));
    if (missingTables.length) fail(payload, `Faltan tablas prospect staging: ${missingTables.join(', ')}`);
    const rowCountsBefore = {}; for (const t of TARGET_TABLES) { const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${t}\``); rowCountsBefore[t] = Number(rows?.[0]?.count ?? -1); }

    if (wantsReadonly) {
      Object.assign(payload, { mode: MODE_READONLY, dryRun: false, tablesFound: TARGET_TABLES.filter((t) => existing.has(t)), missingTables, rowCountsBefore, readonlyEvidence: { verifiedNoTransaction: true, verifiedNoWrite: true, verifiedNoCommit: true, forbiddenDestinationsConfirmed: true } });
      return process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    }

    payload.mode = MODE_COMMIT; payload.dryRun = false;
    const token = payload.syntheticPayloadPreview.token;
    try {
      await connection.beginTransaction(); payload.transactionStarted = true;
      const [leadRes] = await connection.execute('INSERT INTO `lead_sources` (source_code, source_ref, environment, is_test, is_demo, review_status, raw_payload_json, normalized_payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [`demo_whatsapp_${token}`, `source_ref_${token}`, 'staging', 1, 1, 'pending', JSON.stringify({ token }), JSON.stringify({ token })]);
      const [prospectRes] = await connection.execute('INSERT INTO `prospects` (external_ref, source_ref, source, environment, is_test, is_demo, review_status, lead_source_id, name, phone_original, phone_normalized, property_interest, status, intention_level, next_action, raw_payload_json, normalized_payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [`external_ref_${token}`, `source_ref_${token}`, 'demo', 'staging', 1, 1, 'pending', leadRes.insertId, `Demo Prospect ${token}`, '+52 55 1000 0000', '525510000000', `Lote demo ${token}`, 'new', 'high', `followup_${token}`, JSON.stringify({ token }), JSON.stringify({ token })]);
      const [convRes] = await connection.execute('INSERT INTO `whatsapp_conversations` (external_ref, source_ref, prospect_id, source, environment, is_test, is_demo, review_status, phone_original, phone_normalized, raw_payload_json, normalized_payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [`external_ref_${token}`, `source_ref_${token}`, prospectRes.insertId, 'demo', 'staging', 1, 1, 'pending', '+52 55 1000 0000', '525510000000', JSON.stringify({ token }), JSON.stringify({ token })]);
      const [analysisRes] = await connection.execute('INSERT INTO `whatsapp_analyses` (external_ref, source_ref, prospect_id, conversation_id, source, environment, is_test, is_demo, review_status, intention_level, next_action, raw_payload_json, normalized_payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [`external_ref_${token}`, `source_ref_${token}`, prospectRes.insertId, convRes.insertId, 'demo', 'staging', 1, 1, 'pending', 'high', `followup_${token}`, JSON.stringify({ token }), JSON.stringify({ token })]);
      const [followRes] = await connection.execute('INSERT INTO `prospect_followups` (external_ref, source_ref, prospect_id, source, environment, is_test, is_demo, review_status, status, next_action, raw_payload_json, normalized_payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [`external_ref_${token}`, `source_ref_${token}`, prospectRes.insertId, 'demo', 'staging', 1, 1, 'pending', 'pending', `followup_${token}`, JSON.stringify({ token }), JSON.stringify({ token })]);
      const [historyRes] = await connection.execute('INSERT INTO `crm_history_events` (external_ref, source_ref, prospect_id, followup_id, conversation_id, analysis_id, source, environment, is_test, is_demo, review_status, event_type, status, intention_level, next_action, raw_payload_json, normalized_payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [`external_ref_${token}`, `source_ref_${token}`, prospectRes.insertId, followRes.insertId, convRes.insertId, analysisRes.insertId, 'demo', 'staging', 1, 1, 'pending', `prospect_staged_${token}`, 'new', 'high', `followup_${token}`, JSON.stringify({ token }), JSON.stringify({ token })]);

      const rowCountsInsideTransaction = {}; for (const t of TARGET_TABLES) { const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${t}\``); rowCountsInsideTransaction[t] = Number(rows?.[0]?.count ?? -1); }
      const verificationRules = [
        { table: 'lead_sources', where: 'source_code = ? AND source_ref = ?', values: [`demo_whatsapp_${token}`, `source_ref_${token}`] },
        { table: 'prospects', where: 'external_ref = ? AND source_ref = ?', values: [`external_ref_${token}`, `source_ref_${token}`] },
        { table: 'whatsapp_conversations', where: 'external_ref = ? AND source_ref = ?', values: [`external_ref_${token}`, `source_ref_${token}`] },
        { table: 'whatsapp_analyses', where: 'external_ref = ? AND source_ref = ?', values: [`external_ref_${token}`, `source_ref_${token}`] },
        { table: 'prospect_followups', where: 'external_ref = ? AND source_ref = ?', values: [`external_ref_${token}`, `source_ref_${token}`] },
        { table: 'crm_history_events', where: 'external_ref = ? AND source_ref = ? AND event_type = ?', values: [`external_ref_${token}`, `source_ref_${token}`, `prospect_staged_${token}`] }
      ];
      for (const rule of verificationRules) {
        const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${rule.table}\` WHERE ${rule.where}`, rule.values);
        if (Number(rows?.[0]?.count ?? 0) !== 1) fail(payload, `Verificación relacional/token falló en ${rule.table}`);
      }

      await connection.commit(); payload.commitExecuted = true; payload.persistentWriteExecuted = true;
      const rowCountsAfterCommit = {}; for (const t of TARGET_TABLES) { const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${t}\``); rowCountsAfterCommit[t] = Number(rows?.[0]?.count ?? -1); }
      const postCommitVerified = TARGET_TABLES.every((t) => rowCountsAfterCommit[t] === rowCountsBefore[t] + 1); if (!postCommitVerified) fail(payload, 'Row counts post-commit no subieron exactamente +1');

      Object.assign(payload, { insertsAttempted: 6, rollbackExecuted: false, insertedIds: { lead_source_id: leadRes.insertId, prospect_id: prospectRes.insertId, conversation_id: convRes.insertId, analysis_id: analysisRes.insertId, followup_id: followRes.insertId, history_event_id: historyRes.insertId }, token, rowCountsBefore, rowCountsInsideTransaction, rowCountsAfterCommit, postCommitVerified });
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } catch (error) {
      if (payload.transactionStarted && !payload.commitExecuted) { await connection.rollback(); payload.rollbackExecuted = true; }
      fail(payload, error?.message || String(error));
    }
  } finally { await connection.end(); }
}

main().catch((error) => { process.stdout.write(`${JSON.stringify({ ok: false, phase: PHASE, mode: 'error', error: error?.message || String(error) }, null, 2)}\n`); process.exit(1); });
