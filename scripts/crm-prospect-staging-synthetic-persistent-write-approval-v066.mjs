#!/usr/bin/env node
import fs from 'node:fs';

const PHASE = 'v066';
const MODE_APPROVAL = 'approval_evidence_only';
const MODE_READONLY = 'controlled_readonly_evidence';
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
  return `v066_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildPayload() {
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
    mode: MODE_APPROVAL,
    dryRun: true,
    databaseConnectionAttempted: false,
    transactionStarted: false,
    rollbackExecuted: false,
    commitExecuted: false,
    persistentWriteExecuted: false,
    syntheticOnly: true,
    realProspectsUsed: false,
    productionTouched: false,
    targetTables: [...TARGET_TABLES],
    forbiddenDestinations: [...FORBIDDEN_DESTINATIONS],
    syntheticPayloadPreview,
    proposedPersistentWritePlan: [
      { table: 'lead_sources', action: 'INSERT synthetic source root row' },
      { table: 'prospects', action: 'INSERT synthetic prospect linked to lead_sources.id' },
      { table: 'whatsapp_conversations', action: 'INSERT synthetic conversation linked to prospects.id' },
      { table: 'whatsapp_analyses', action: 'INSERT synthetic analysis linked to prospects.id and whatsapp_conversations.id' },
      { table: 'prospect_followups', action: 'INSERT synthetic followup linked to prospects.id' },
      { table: 'crm_history_events', action: 'INSERT synthetic history event linked to full relation chain' }
    ],
    requiredApprovalGatesForFutureCommit: [
      'Phase upgrade to v067+ with explicit commit protocol documented and approved',
      'ADEIN_DB_TARGET=staging (strict)',
      'Dedicated commit gate token not available in v066',
      'Read-only evidence and pre-commit row-count baseline captured',
      'Operational approval by responsible engineer and rollback owner'
    ],
    requiredPreCommitChecks: [
      'Validate all 6 target tables exist in staging schema',
      'Verify forbidden destinations are not in target write plan',
      'Capture pre-commit row counts for evidence',
      'Confirm service health checks stay HTTP 200 during maintenance window',
      'Confirm synthetic-only payload and test flags remain true'
    ],
    abortConditions: [
      'Any production signal detected',
      'Any commit or persistent-write env signal detected',
      'Any write gate value implying real commit in v066',
      'Missing required staging read-only gates in controlled evidence mode',
      'Forbidden destinations detected in write plan'
    ],
    expectedEvidenceAfterFutureCommit: [
      'Row counts increase by +1 on each of the 6 staging tables for the synthetic token',
      'Referential links are consistent across all inserted rows',
      'Audit artifact includes transaction id, inserted ids, and post-check summary',
      'Production remains untouched and out-of-scope'
    ],
    rollbackPlanIfFutureCommitFails: {
      strategy: 'manual_compensating_delete_by_token',
      sequence: ['crm_history_events', 'prospect_followups', 'whatsapp_analyses', 'whatsapp_conversations', 'prospects', 'lead_sources'],
      safeguards: ['scope restricted to synthetic token', 'staging only', 'pre-delete backup evidence required']
    },
    safetyEnvelope: {
      defaultMode: MODE_APPROVAL,
      maxWriteMode: 'none_in_v066',
      blockedSignals: [
        'NODE_ENV=production',
        'ADEIN_DB_TARGET=production',
        'ADEIN_DB_ENV=production',
        'ADEIN_DB_COMMIT=1',
        'ADEIN_DB_ALLOW_PERSISTENT_WRITE=1',
        'ADEIN_DB_ENABLE_WRITES=1',
        'ADEIN_DB_WRITE_GATE=REAL_COMMIT',
        'ADEIN_DB_WRITE_GATE=PERSISTENT_WRITE',
        'ADEIN_DB_WRITE_GATE=COMMIT_V066',
        'ADEIN_DB_APPROVAL_TOKEN=APPROVE_REAL_COMMIT'
      ]
    }
  };
}

function abort(payload, reason, code = 1) {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: PHASE, aborted: true, reason, ...payload }, null, 2)}\n`);
  process.exit(code);
}

function containsDangerousSignals() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.ADEIN_DB_TARGET === 'production' ||
    process.env.ADEIN_DB_ENV === 'production' ||
    process.env.ADEIN_DB_COMMIT === '1' ||
    process.env.ADEIN_DB_ALLOW_PERSISTENT_WRITE === '1' ||
    process.env.ADEIN_DB_ENABLE_WRITES === '1' ||
    process.env.ADEIN_DB_WRITE_GATE === 'REAL_COMMIT' ||
    process.env.ADEIN_DB_WRITE_GATE === 'PERSISTENT_WRITE' ||
    process.env.ADEIN_DB_WRITE_GATE === 'COMMIT_V066' ||
    process.env.ADEIN_DB_APPROVAL_TOKEN === 'APPROVE_REAL_COMMIT'
  );
}

async function main() {
  const payload = buildPayload();

  if (containsDangerousSignals()) {
    abort(payload, 'persistent write is not enabled in v066');
  }

  const wantsReadonlyEvidence =
    process.env.ADEIN_CRM_PROSPECT_STAGING_PERSISTENT_WRITE_APPROVAL_V066 === '1' &&
    process.env.ADEIN_DB_TARGET === 'staging' &&
    process.env.ADEIN_DB_READONLY_EVIDENCE === '1';

  if (!wantsReadonlyEvidence) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  const envFile = process.env.ADEIN_DB_ENV_FILE;
  if (!envFile || !fs.existsSync(envFile)) abort(payload, 'ADEIN_DB_ENV_FILE faltante o inexistente para controlled_readonly_evidence');

  parseEnvFile(envFile);
  const missingDbVars = REQUIRED_DB_ENV.filter((k) => !process.env[k]);
  if (missingDbVars.length > 0) abort(payload, `Faltan variables DB: ${missingDbVars.join(', ')}`);

  payload.mode = MODE_READONLY;
  payload.dryRun = false;
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
    if (forbiddenFound.length > 0) abort(payload, `Destino prohibido detectado: ${forbiddenFound.join(', ')}`);

    const [tableRows] = await connection.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${TARGET_TABLES.map(() => '?').join(',')})`,
      [process.env.ADEIN_DB_NAME, ...TARGET_TABLES]
    );
    const existing = new Set(tableRows.map((r) => r.TABLE_NAME));
    const missingTables = TARGET_TABLES.filter((t) => !existing.has(t));

    const rowCounts = {};
    for (const table of TARGET_TABLES) {
      const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      rowCounts[table] = Number(rows?.[0]?.count ?? -1);
    }

    const nonZero = Object.entries(rowCounts).filter(([, count]) => count !== 0).map(([table, count]) => ({ table, count }));

    Object.assign(payload, {
      tablesFound: TARGET_TABLES.filter((t) => existing.has(t)),
      missingTables,
      rowCounts,
      warnings: nonZero.length > 0
        ? ['Staging ya contiene datos previos en una o más tablas; esto no bloquea evidencia read-only.', ...nonZero.map((x) => `${x.table}: ${x.count}`)]
        : [],
      readonlyEvidence: {
        verifiedNoTransaction: true,
        verifiedNoWrite: true,
        verifiedNoCommit: true,
        forbiddenDestinationsConfirmed: true
      }
    });

    payload.ok = missingTables.length === 0;
    if (missingTables.length > 0) {
      payload.aborted = true;
      payload.reason = `Faltan tablas prospect staging: ${missingTables.join(', ')}`;
    }

    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: PHASE, aborted: true, reason: error.message }, null, 2)}\n`);
  process.exit(1);
});
