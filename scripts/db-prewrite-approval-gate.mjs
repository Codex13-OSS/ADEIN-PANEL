#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const phase = 'v055';
const name = 'prewrite_approval_gate';
const baseTag = 'v0.1.45-adein-crm-backup-snapshot-evidence';
const expectedHead = 'ffd8b59';

const allowedTables = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const forbiddenTables = [
  'crm_users',
  'sellers',
  'crm_followups',
  'import_batches',
  'import_raw_rows',
  'migration_plans',
  'migration_plan_events',
  'audit_log',
  'any table not listed in allowedTables'
];

const dangerousEnvChecks = [
  ['ADEIN_DB_COMMIT', '1'],
  ['ADEIN_DB_ALLOW_PERSISTENT_WRITE', '1'],
  ['ADEIN_DB_ENABLE_WRITES', '1'],
  ['ADEIN_DB_MODE', 'write'],
  ['ADEIN_DB_MODE', 'read_write'],
  ['ADEIN_DB_WRITE_GATE', 'REAL_COMMIT'],
  ['ADEIN_DB_WRITE_GATE', 'V055_REAL_COMMIT'],
  ['ADEIN_DB_APPROVAL_TOKEN', 'APPROVE_REAL_COMMIT'],
  ['ADEIN_DB_APPROVAL_TOKEN', 'APPROVE_MINIMUM_PERSISTENT_WRITE_V056']
];

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

function asHealth(url) {
  return { url, checked: false, status: 'not_checked', httpStatus: null };
}

async function checkHealth(url) {
  try {
    let response = await fetch(url, { method: 'HEAD' });
    if (response.status === 405) response = await fetch(url, { method: 'GET' });
    return { url, checked: true, status: response.ok ? 'alive' : 'non_200', httpStatus: response.status };
  } catch {
    return { url, checked: true, status: 'unreachable', httpStatus: null };
  }
}

async function run() {
  const now = new Date().toISOString();
  const controlledMode = process.env.ADEIN_V055_PREWRITE_APPROVAL_GATE === '1';
  const evidenceJsonPath = process.env.ADEIN_V054_EVIDENCE_JSON || null;
  const backupSqlPath = process.env.ADEIN_V054_BACKUP_SQL || null;
  const expectedSha256 = process.env.ADEIN_V054_BACKUP_SHA256 || null;

  const payload = {
    ok: true,
    phase,
    name,
    dryRun: true,
    approvalGateOnly: true,
    readOnly: true,
    writesEnabled: false,
    commitAllowed: false,
    commitExecuted: false,
    persistentWriteExecuted: false,
    databaseConnectionAttempted: false,
    databaseConnected: false,
    credentialsInRepo: false,
    realDataPersistedInRepo: false,
    noWriteSqlExecuted: true,
    noSchemaChanges: true,
    noDataMigration: true,
    productionPortTouched: false,
    pm2Modified: false,
    baseCheckpoint: { tag: baseTag, expectedHead },
    previousBackupEvidence: {
      evidenceJsonPath,
      backupSqlPath,
      expectedSha256,
      actualSha256: null,
      sha256Matches: false,
      evidenceJsonExists: false,
      backupSqlExists: false,
      backupSizeBytes: null
    },
    currentRowCounts: { captured: false, counts: {} },
    healthChecks: {
      production3006: asHealth('http://127.0.0.1:3006'),
      staging3016: asHealth('http://127.0.0.1:3016')
    },
    minimumPersistentWriteCandidate: {
      phaseCandidate: 'v056',
      requiresHumanApproval: true,
      syntheticOnly: true,
      realClientDataAllowed: false,
      allowedTables,
      forbiddenTables,
      description: 'Only synthetic controlled inserts for minimum relational set; never execute in v055.'
    },
    approvalArtifact: {
      humanApprovalRequired: true,
      approvalTokenRequired: 'APPROVE_MINIMUM_PERSISTENT_WRITE_V056',
      approvalMustReferenceBackupSha256: true,
      approvalMustReferenceRowCounts: true,
      approvalMustReferenceTables: true,
      approvalValidForSingleRunOnly: true
    },
    rollbackPlan: [
      'Stop any future write execution immediately if invariants fail.',
      'Restore from verified v054 backup SQL in isolated environment first.',
      'Re-run row counts and compare with pre-write evidence before promotion.',
      'Require fresh human approval for any retried write run.'
    ],
    abortConditions: [
      'Any dangerous write env flag detected.',
      'Missing or invalid v054 backup evidence JSON or SQL path.',
      'SHA256 mismatch against ADEIN_V054_BACKUP_SHA256.',
      'Read-only DB validation cannot connect or query allowed tables.',
      'Production/staging health checks are not alive.'
    ],
    generatedAt: now
  };

  for (const [k, v] of dangerousEnvChecks) {
    if (process.env[k] === v) {
      payload.ok = false;
      payload.error = `Dangerous write-related env detected: ${k}=${v}`;
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      process.exit(1);
    }
  }

  if (!controlledMode) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  const envFilePath = process.env.ADEIN_DB_ENV_FILE;
  if (!envFilePath || !evidenceJsonPath || !backupSqlPath || !expectedSha256) {
    payload.ok = false;
    payload.error = 'Controlled mode requires ADEIN_DB_ENV_FILE, ADEIN_V054_EVIDENCE_JSON, ADEIN_V054_BACKUP_SQL, ADEIN_V054_BACKUP_SHA256';
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exit(1);
  }

  payload.databaseConnectionAttempted = true;
  payload.previousBackupEvidence.evidenceJsonExists = fs.existsSync(evidenceJsonPath);
  payload.previousBackupEvidence.backupSqlExists = fs.existsSync(backupSqlPath);

  if (!payload.previousBackupEvidence.evidenceJsonExists || !payload.previousBackupEvidence.backupSqlExists || !fs.existsSync(envFilePath)) {
    payload.ok = false;
    payload.error = 'Required controlled-mode files are missing';
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exit(1);
  }

  const sqlBuffer = fs.readFileSync(backupSqlPath);
  payload.previousBackupEvidence.backupSizeBytes = sqlBuffer.byteLength;
  payload.previousBackupEvidence.actualSha256 = crypto.createHash('sha256').update(sqlBuffer).digest('hex');
  payload.previousBackupEvidence.sha256Matches = payload.previousBackupEvidence.actualSha256 === expectedSha256;

  try {
    const envData = parseEnvFile(envFilePath);
    const { createConnection } = await import('mysql2/promise');
    const conn = await createConnection({
      host: envData.ADEIN_DB_HOST,
      port: Number(envData.ADEIN_DB_PORT),
      user: envData.ADEIN_DB_USER,
      password: envData.ADEIN_DB_PASSWORD,
      database: envData.ADEIN_DB_NAME
    });
    payload.databaseConnected = true;

    for (const table of allowedTables) {
      const [rows] = await conn.query(`SELECT COUNT(*) AS row_count FROM \`${table}\``);
      payload.currentRowCounts.counts[table] = Number(rows?.[0]?.row_count ?? 0);
    }
    payload.currentRowCounts.captured = true;
    await conn.end();
  } catch (error) {
    payload.ok = false;
    payload.error = `Read-only DB verification failed: ${error.message}`;
  }

  payload.healthChecks.production3006 = await checkHealth(payload.healthChecks.production3006.url);
  payload.healthChecks.staging3016 = await checkHealth(payload.healthChecks.staging3016.url);
  payload.productionPortTouched = true;

  if (!payload.previousBackupEvidence.sha256Matches) payload.ok = false;
  if (payload.healthChecks.production3006.status !== 'alive' || payload.healthChecks.staging3016.status !== 'alive') payload.ok = false;

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  if (!payload.ok) process.exit(1);
}

run().catch((error) => {
  const fallback = {
    ok: false,
    phase,
    name,
    error: error.message,
    generatedAt: new Date().toISOString()
  };
  process.stdout.write(`${JSON.stringify(fallback, null, 2)}\n`);
  process.exit(1);
});
