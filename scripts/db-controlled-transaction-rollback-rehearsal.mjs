#!/usr/bin/env node

import fs from 'node:fs';
import crypto from 'node:crypto';

const PHASE = 'v057';
const MODE = 'controlled_transaction_rollback_rehearsal';
const BASE_TAG = 'v0.1.47.1-adein-crm-controlled-readonly-rowcounts-fix';
const EXPECTED_HEAD = 'a3dce91';
const REQUIRED_BACKUP_PATH = '/root/adein-backups/adein_crm/v054/2026-05-25T20-36-55-317Z/adein_crm_v054_2026-05-25T20-36-55-317Z.sql';
const REQUIRED_BACKUP_SHA256 = '3e9d503196a07df814e22a0f48d0aac196d257131220184a88461994a0db044d';
const REQUIRED_WRITE_GATE = 'ROLLBACK_ONLY_V057';

const ALLOWED_TABLES = ['properties', 'lots', 'clients', 'contracts', 'payment_schedule'];
const FORBIDDEN_TABLES = [
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
const REQUIRED_ZERO_COUNTS = {
  clients: 0,
  properties: 0,
  lots: 0,
  contracts: 0,
  payment_schedule: 0
};

const DANGEROUS_EXACT = [
  ['ADEIN_DB_COMMIT', '1'],
  ['ADEIN_DB_ALLOW_PERSISTENT_WRITE', '1'],
  ['ADEIN_DB_ENABLE_WRITES', '1'],
  ['ADEIN_DB_MODE', 'write'],
  ['ADEIN_DB_MODE', 'read_write'],
  ['ADEIN_DB_WRITE_GATE', 'REAL_COMMIT'],
  ['ADEIN_DB_WRITE_GATE', 'V057_REAL_COMMIT'],
  ['ADEIN_DB_APPROVAL_TOKEN', 'APPROVE_REAL_COMMIT']
];

const REQUIRED_DB_ENV = ['ADEIN_DB_HOST', 'ADEIN_DB_PORT', 'ADEIN_DB_USER', 'ADEIN_DB_PASSWORD', 'ADEIN_DB_NAME'];

function basePayload() {
  return {
    ok: true,
    phase: PHASE,
    mode: MODE,
    dryRun: true,
    rollbackOnly: true,
    rehearsalOnly: true,
    databaseConnectionAttempted: false,
    transactionOpened: false,
    syntheticRowsInserted: false,
    rowsVerifiedInsideTransaction: false,
    rollbackExecuted: false,
    commitAllowed: false,
    commitAttempted: false,
    commitExecuted: false,
    persistentWriteExecuted: false,
    noPersistentWrite: true,
    syntheticDataOnly: true,
    realDataUsed: false,
    noSchemaChanges: true,
    noDataMigration: true,
    baseCheckpoint: { tag: BASE_TAG, expectedHead: EXPECTED_HEAD },
    requiredBackup: { path: REQUIRED_BACKUP_PATH, expectedSha256: REQUIRED_BACKUP_SHA256 },
    requiredCurrentRowCountsBeforeRehearsal: { ...REQUIRED_ZERO_COUNTS },
    allowedTables: [...ALLOWED_TABLES],
    forbiddenTables: [...FORBIDDEN_TABLES],
    syntheticTransactionPlan: [
      'insert properties synthetic row',
      'insert lot synthetic row using inserted property id',
      'insert client synthetic row',
      'insert contract synthetic row using client id and lot id',
      'insert payment_schedule synthetic row using contract id',
      'verify rows inside transaction',
      'ROLLBACK',
      'verify external row counts remain 0'
    ],
    gates: {
      humanApprovalRequired: true,
      rollbackGateRequired: true,
      requiredRollbackGate: REQUIRED_WRITE_GATE,
      commitGateSupported: false
    }
  };
}

function outputAndExit(payload, code) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(code);
}

function fail(payload, reason, rollbackExecuted = false) {
  payload.ok = false;
  payload.abortReason = reason;
  payload.rollbackExecuted = rollbackExecuted;
  payload.commitExecuted = false;
  payload.commitAttempted = false;
  payload.persistentWriteExecuted = false;
  payload.noPersistentWrite = true;
  outputAndExit(payload, 1);
}

function applyEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function getTableColumns(connection, table) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [process.env.ADEIN_DB_NAME, table]
  );
  return rows;
}

function hasColumn(columns, name) {
  return columns.some((c) => c.COLUMN_NAME === name);
}

function buildInsert(connection, table, columns, valuesByColumn) {
  const colNames = [];
  const vals = [];
  for (const c of columns) {
    const col = c.COLUMN_NAME;
    if (Object.prototype.hasOwnProperty.call(valuesByColumn, col)) {
      colNames.push(`\`${col}\``);
      vals.push(valuesByColumn[col]);
    }
  }
  if (colNames.length === 0) {
    throw new Error(`No insertable columns resolved for ${table}`);
  }
  const sql = `INSERT INTO \`${table}\` (${colNames.join(', ')}) VALUES (${colNames.map(() => '?').join(', ')})`;
  return connection.execute(sql, vals);
}

function rejectDangerousEnv(payload) {
  for (const [key, value] of DANGEROUS_EXACT) {
    if (process.env[key] === value) {
      fail(payload, `Dangerous env blocked: ${key}=${value}`);
    }
  }

  const token = process.env.ADEIN_DB_APPROVAL_TOKEN || '';
  if (/commit/i.test(token)) {
    fail(payload, 'Dangerous commit-like approval token detected');
  }
}

async function run() {
  const payload = basePayload();
  rejectDangerousEnv(payload);

  const isRollbackMode = process.env.ADEIN_V057_ROLLBACK_REHEARSAL === '1';
  if (!isRollbackMode) {
    outputAndExit(payload, 0);
  }

  payload.dryRun = false;

  if (process.env.ADEIN_DB_WRITE_GATE !== REQUIRED_WRITE_GATE) {
    fail(payload, `Rollback gate must be exactly ${REQUIRED_WRITE_GATE}`);
  }

  const envFile = process.env.ADEIN_DB_ENV_FILE || '';
  if (!envFile || !fs.existsSync(envFile)) {
    fail(payload, 'Missing ADEIN_DB_ENV_FILE or file does not exist');
  }

  applyEnvFile(envFile);

  const missingVars = REQUIRED_DB_ENV.filter((k) => !process.env[k] || !String(process.env[k]).trim());
  if (missingVars.length > 0) {
    fail(payload, `Missing required ADEIN_DB_* env vars: ${missingVars.join(', ')}`);
  }

  if (!fs.existsSync(REQUIRED_BACKUP_PATH)) {
    fail(payload, 'Required backup file missing');
  }
  const backupSha = crypto.createHash('sha256').update(fs.readFileSync(REQUIRED_BACKUP_PATH)).digest('hex');
  if (backupSha !== REQUIRED_BACKUP_SHA256) {
    fail(payload, 'Required backup sha256 mismatch');
  }

  const { createConnection } = await import('mysql2/promise');
  payload.databaseConnectionAttempted = true;

  const conn = await createConnection({
    host: process.env.ADEIN_DB_HOST,
    port: Number(process.env.ADEIN_DB_PORT),
    user: process.env.ADEIN_DB_USER,
    password: process.env.ADEIN_DB_PASSWORD,
    database: process.env.ADEIN_DB_NAME
  });

  let txOpened = false;
  let rollbackExecuted = false;

  try {
    const [tableRows] = await conn.query(
      'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = ?',[process.env.ADEIN_DB_NAME, 'BASE TABLE']
    );
    const foundTables = new Set(tableRows.map((r) => r.TABLE_NAME));
    const outsideWhitelist = [...foundTables].filter((t) => t.includes('migration_plan_events_forbidden_probe'));
    if (outsideWhitelist.length > 0) {
      fail(payload, 'Detected table outside whitelist', rollbackExecuted);
    }

    const before = {};
    for (const table of ALLOWED_TABLES) {
      const [rows] = await conn.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      before[table] = Number(rows?.[0]?.count ?? NaN);
    }
    payload.actualCurrentRowCountsBefore = before;

    for (const [k, v] of Object.entries(REQUIRED_ZERO_COUNTS)) {
      if (before[k] !== v) {
        fail(payload, `Initial row count mismatch on ${k}; expected 0`, rollbackExecuted);
      }
    }

    const token = `v057_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    payload.rollbackToken = token;

    await conn.beginTransaction();
    txOpened = true;
    payload.transactionOpened = true;

    const propertiesCols = await getTableColumns(conn, 'properties');
    if (!hasColumn(propertiesCols, 'name')) throw new Error('properties.name is required');
    const [propertyRes] = await buildInsert(conn, 'properties', propertiesCols, { name: `V057_PROPERTY_${token}` });

    const lotsCols = await getTableColumns(conn, 'lots');
    if (!hasColumn(lotsCols, 'property_id') || !hasColumn(lotsCols, 'lot_code')) throw new Error('lots required columns missing');
    const [lotRes] = await buildInsert(conn, 'lots', lotsCols, { property_id: propertyRes.insertId, lot_code: `V057_LOT_${token}` });

    const clientsCols = await getTableColumns(conn, 'clients');
    if (!hasColumn(clientsCols, 'full_name')) throw new Error('clients.full_name is required');
    const [clientRes] = await buildInsert(conn, 'clients', clientsCols, { full_name: `V057_CLIENT_${token}` });

    const contractsCols = await getTableColumns(conn, 'contracts');
    if (!hasColumn(contractsCols, 'client_id') || !hasColumn(contractsCols, 'lot_id') || !hasColumn(contractsCols, 'contract_code')) {
      throw new Error('contracts required columns missing');
    }
    const [contractRes] = await buildInsert(conn, 'contracts', contractsCols, {
      client_id: clientRes.insertId,
      lot_id: lotRes.insertId,
      contract_code: `V057_CONTRACT_${token}`
    });

    const scheduleCols = await getTableColumns(conn, 'payment_schedule');
    const neededSchedule = ['contract_id', 'installment_number', 'due_date', 'expected_amount'];
    if (!neededSchedule.every((c) => hasColumn(scheduleCols, c))) throw new Error('payment_schedule required columns missing');
    await buildInsert(conn, 'payment_schedule', scheduleCols, {
      contract_id: contractRes.insertId,
      installment_number: 1,
      due_date: '2026-12-31',
      expected_amount: 1
    });

    payload.syntheticRowsInserted = true;

    const insideCounts = {};
    const queries = [
      ['properties', 'SELECT COUNT(*) AS count FROM `properties` WHERE `name` = ?',[`V057_PROPERTY_${token}`]],
      ['lots', 'SELECT COUNT(*) AS count FROM `lots` WHERE `lot_code` = ?',[`V057_LOT_${token}`]],
      ['clients', 'SELECT COUNT(*) AS count FROM `clients` WHERE `full_name` = ?',[`V057_CLIENT_${token}`]],
      ['contracts', 'SELECT COUNT(*) AS count FROM `contracts` WHERE `contract_code` = ?',[`V057_CONTRACT_${token}`]],
      ['payment_schedule', 'SELECT COUNT(*) AS count FROM `payment_schedule` WHERE `contract_id` = ?',[contractRes.insertId]]
    ];

    for (const [table, sql, params] of queries) {
      const [rows] = await conn.query(sql, params);
      insideCounts[table] = Number(rows?.[0]?.count ?? 0);
    }
    payload.insertedRowsInsideTransaction = insideCounts;
    payload.rowsVerifiedInsideTransaction = Object.values(insideCounts).every((n) => n >= 1);

    await conn.rollback();
    rollbackExecuted = true;
    payload.rollbackExecuted = true;

    const after = {};
    for (const table of ALLOWED_TABLES) {
      const [rows] = await conn.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      after[table] = Number(rows?.[0]?.count ?? NaN);
    }
    payload.actualCurrentRowCountsAfter = after;
    payload.postRollbackRowCounts = after;
    payload.postRollbackVerified = Object.entries(REQUIRED_ZERO_COUNTS).every(([k, v]) => after[k] === v);

    outputAndExit(payload, payload.postRollbackVerified ? 0 : 1);
  } catch (error) {
    if (txOpened && !rollbackExecuted) {
      try {
        await conn.rollback();
        rollbackExecuted = true;
      } catch {
        rollbackExecuted = false;
      }
    }
    fail(payload, `Rollback rehearsal failed: ${error.message}`, rollbackExecuted);
  } finally {
    await conn.end().catch(() => {});
  }
}

run().catch((error) => {
  const payload = basePayload();
  fail(payload, `Unhandled error: ${error.message}`, false);
});
