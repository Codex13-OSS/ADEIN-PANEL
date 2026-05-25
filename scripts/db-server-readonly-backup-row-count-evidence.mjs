#!/usr/bin/env node

import fs from 'node:fs';

const phase = 'v053';
const name = 'server_readonly_backup_row_count_evidence';
const expectedBaseTag = 'v0.1.42-adein-crm-server-staging-preflight';
const expectedBaseHead = '8ca90f4';

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

const blockedSqlTokens = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'COMMIT', 'ROLLBACK'];

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

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function validateReadOnlyQuery(sql) {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  if (!/^SELECT\s+/i.test(normalized)) return false;

  const upper = normalized.toUpperCase();
  return !blockedSqlTokens.some((token) => upper.includes(token));
}

async function run() {
  const now = new Date().toISOString();
  const explicitGateEnabled = process.env.ADEIN_V053_SERVER_READONLY_EVIDENCE === '1';
  const envFilePath = process.env.ADEIN_DB_ENV_FILE;
  const readyForServerReadOnly = explicitGateEnabled && envFilePath === '/root/adein-secrets/adein-crm-db.env';

  const payload = {
    ok: true,
    phase,
    name,
    mode: 'read_only_evidence',
    dryRun: !readyForServerReadOnly,
    evidenceOnly: true,
    readOnly: true,
    writesEnabled: false,
    commitAllowed: false,
    commitExecuted: false,
    persistentWriteExecuted: false,
    databaseConnectionAttempted: false,
    databaseConnected: false,
    sourceOfCredentials: 'external_env_file_or_not_loaded',
    baseCheckpoint: {
      tag: expectedBaseTag,
      expectedHead: expectedBaseHead
    },
    serverTargets: {
      productionUrl: 'http://127.0.0.1:3006',
      stagingUrl: 'http://127.0.0.1:3016',
      productionMustStayAlive: true,
      stagingMustStayAlive: true
    },
    allowedTables,
    forbiddenTables,
    backupSnapshotEvidence: {
      backupRequiredBeforePersistentWrite: true,
      recommendedBackupLocation: '/root/adein-backups',
      noPersistentWriteWithoutBackup: true,
      restorePlanRequired: true,
      rowCountsCapturedAt: null
    },
    rowCountEvidence: {
      collected: false,
      rowCountsCapturedAt: null,
      counts: {},
      allowedTablesOnly: true,
      queryTemplate: 'SELECT COUNT(*) AS row_count FROM <allowed_table>',
      connectionMode: 'not_attempted'
    },
    productionHealthEvidence: {
      url: 'http://127.0.0.1:3006',
      checked: false,
      status: 'planned',
      httpStatus: null
    },
    stagingHealthEvidence: {
      url: 'http://127.0.0.1:3016',
      checked: false,
      status: 'planned',
      httpStatus: null
    },
    safetyEnvelope: {
      noWriteSqlExecuted: true,
      noSchemaChanges: true,
      noDataMigration: true,
      credentialsInRepo: false,
      realDataPersistedInRepo: false,
      forbiddenTableAccessDetected: false,
      productionPortTouched: false,
      pm2Modified: false
    },
    abortConditions: [
      'missing ADEIN_V053_SERVER_READONLY_EVIDENCE=1',
      'missing ADEIN_DB_ENV_FILE=/root/adein-secrets/adein-crm-db.env',
      'credentials file missing/unreadable',
      'credentials file missing required DB variables',
      'attempt to query forbidden table',
      'query not strictly SELECT COUNT(*) on allowed table',
      'production or staging health check fails'
    ],
    nextRecommendedStep:
      'v054: execute controlled server-side read-only evidence run with verified backup/snapshot artifacts and human approval before any write-capable phase.'
  };

  if (!readyForServerReadOnly) {
    payload.rowCountEvidence.connectionMode = 'default_dry_run_no_db_connection';
    payload.nextRequiredGates = {
      ADEIN_V053_SERVER_READONLY_EVIDENCE: '1',
      ADEIN_DB_ENV_FILE: '/root/adein-secrets/adein-crm-db.env'
    };
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  payload.databaseConnectionAttempted = true;
  payload.sourceOfCredentials = 'external_env_file';

  try {
    if (!fs.existsSync(envFilePath)) {
      throw new Error('Credentials file does not exist.');
    }

    const envData = parseEnvFile(envFilePath);
    const requiredKeys = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
    const missingKeys = requiredKeys.filter((key) => !envData[key]);

    if (missingKeys.length > 0) {
      throw new Error(`Missing required DB env vars: ${missingKeys.join(', ')}`);
    }

    const { createConnection } = await import('mysql2/promise');
    const connection = await createConnection({
      host: envData.DB_HOST,
      port: Number(envData.DB_PORT),
      database: envData.DB_NAME,
      user: envData.DB_USER,
      password: envData.DB_PASSWORD,
      ssl: envData.DB_SSL === '1' ? {} : undefined
    });

    payload.databaseConnected = true;
    payload.rowCountEvidence.connectionMode = 'server_readonly';

    const counts = {};

    for (const tableName of allowedTables) {
      const query = `SELECT COUNT(*) AS row_count FROM \`${tableName}\``;
      if (!validateReadOnlyQuery(query)) {
        throw new Error(`Unsafe query blocked for table ${tableName}`);
      }

      const [rows] = await connection.query(query);
      counts[tableName] = Number(rows?.[0]?.row_count ?? 0);
    }

    await connection.end();

    const healthCheck = async (url) => {
      try {
        const response = await fetch(url, { method: 'GET' });
        return { checked: true, status: response.ok ? 'alive' : 'non_200', httpStatus: response.status };
      } catch {
        return { checked: true, status: 'unreachable', httpStatus: null };
      }
    };

    const productionHealth = await healthCheck(payload.productionHealthEvidence.url);
    const stagingHealth = await healthCheck(payload.stagingHealthEvidence.url);

    payload.productionHealthEvidence = { ...payload.productionHealthEvidence, ...productionHealth };
    payload.stagingHealthEvidence = { ...payload.stagingHealthEvidence, ...stagingHealth };

    payload.rowCountEvidence.collected = true;
    payload.rowCountEvidence.rowCountsCapturedAt = now;
    payload.rowCountEvidence.counts = counts;
    payload.backupSnapshotEvidence.rowCountsCapturedAt = now;
  } catch (error) {
    payload.ok = false;
    payload.error = error.message;
  }

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(payload.ok ? 0 : 1);
}

run();
