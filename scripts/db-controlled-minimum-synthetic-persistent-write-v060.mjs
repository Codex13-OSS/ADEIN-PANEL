#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';
import { createHash } from 'node:crypto';

const PHASE = 'v060';
const MODE_DRY = 'dry_run_planning_only';
const MODE_REAL = 'controlled_synthetic_persistent_write';
const ALLOWED_TABLES = ['properties', 'lots', 'clients', 'contracts', 'payment_schedule'];
const REQUIRED_GATES = {
  ADEIN_V060_SYNTHETIC_PERSISTENT_WRITE: '1',
  ADEIN_V060_WRITE_GATE: 'CONTROLLED_SYNTHETIC_PERSISTENT_WRITE_V060',
  ADEIN_V060_APPROVAL_TOKEN: 'APPROVE_SYNTHETIC_STAGING_WRITE_V060',
  ADEIN_V060_REQUIRE_EMPTY_ALLOWED_TABLES: '1'
};
const REQUIRED_DB_ENV = ['ADEIN_DB_HOST', 'ADEIN_DB_PORT', 'ADEIN_DB_USER', 'ADEIN_DB_PASSWORD', 'ADEIN_DB_NAME'];
const TOKEN_TEXTUAL_CANDIDATE_COLUMNS = ['name', 'full_name', 'lot_code', 'contract_code', 'email', 'phone', 'notes', 'description', 'status', 'synthetic_token'];
const TEXTUAL_TYPES = new Set(['char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext']);

function out(payload, code = 0) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(code);
}

function fail(payload, message, code = 1) {
  out({ ...payload, ok: false, error: message }, code);
}

function applyEnvFile(path) {
  const raw = fs.readFileSync(path, 'utf8');
  for (const lineRaw of raw.split(/\r?\n/u)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

async function getColumns(conn, dbName, table) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, DATA_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [dbName, table]
  );
  return rows;
}

function getRequiredColumns(columns) {
  return columns
    .filter((c) => c.IS_NULLABLE === 'NO' && c.COLUMN_DEFAULT === null && !String(c.EXTRA || '').toLowerCase().includes('auto_increment'))
    .map((c) => c.COLUMN_NAME);
}

function validateRequiredColumns(requiredColumns, providedColumns) {
  return requiredColumns.filter((c) => !providedColumns.includes(c));
}

async function insertRow(conn, table, values) {
  const cols = Object.keys(values);
  const sql = `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
  const [res] = await conn.execute(sql, cols.map((c) => values[c]));
  return Number(res.insertId || 0);
}

async function countRows(conn, table) {
  const [rows] = await conn.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
  return Number(rows?.[0]?.count ?? NaN);
}

function resolveTokenSearchableColumns(columns) {
  const byName = columns.filter((c) => TOKEN_TEXTUAL_CANDIDATE_COLUMNS.includes(c.COLUMN_NAME));
  const textual = byName.filter((c) => TEXTUAL_TYPES.has(String(c.DATA_TYPE || '').toLowerCase()));
  return textual.map((c) => c.COLUMN_NAME);
}

async function queryTokenMatchesInTable(conn, table, searchableColumns, token) {
  if (searchableColumns.length === 0) {
    return { table, matchCount: 0, checkedColumns: [], skipped: true, reason: 'no_textual_candidate_columns' };
  }

  const where = searchableColumns.map((c) => `\`${c}\` LIKE ?`).join(' OR ');
  const sql = `SELECT COUNT(*) AS count FROM \`${table}\` WHERE ${where}`;
  const [rows] = await conn.query(sql, searchableColumns.map(() => `%${token}%`));
  const matchCount = Number(rows?.[0]?.count ?? 0);
  return { table, matchCount, checkedColumns: searchableColumns, skipped: false, reason: null };
}

function basePayload() {
  return {
    ok: true,
    phase: PHASE,
    mode: MODE_DRY,
    dryRun: true,
    persistentWritePlanned: true,
    persistentWriteExecuted: false,
    commitAllowed: false,
    commitExecuted: false,
    databaseConnected: false,
    transactionOpened: false,
    rollbackExecuted: false,
    postCommitFailure: false,
    insertsExecuted: 0,
    plannedRows: 5,
    syntheticOnly: true,
    allowedTables: ALLOWED_TABLES,
    expectedRowCountDelta: { properties: 1, lots: 1, clients: 1, contracts: 1, payment_schedule: 1 }
  };
}

async function run() {
  const payload = basePayload();
  if (process.env.ADEIN_V060_SYNTHETIC_PERSISTENT_WRITE !== '1') out(payload, 0);

  payload.mode = MODE_REAL;
  payload.dryRun = false;

  for (const [k, v] of Object.entries(REQUIRED_GATES)) {
    if (process.env[k] !== v) fail(payload, `Gate inválido: ${k} debe ser exactamente ${v}`);
  }

  const envFile = process.env.ADEIN_DB_ENV_FILE || '';
  if (!envFile || !fs.existsSync(envFile)) fail(payload, 'ADEIN_DB_ENV_FILE faltante o inexistente');

  const backupFile = process.env.ADEIN_V060_BACKUP_EVIDENCE_FILE || '';
  const expectedBackupSha = process.env.ADEIN_V060_EXPECTED_BACKUP_SHA256 || '';
  if (!backupFile || !fs.existsSync(backupFile)) fail(payload, 'Backup evidence file faltante');
  if (!expectedBackupSha) fail(payload, 'ADEIN_V060_EXPECTED_BACKUP_SHA256 faltante');

  const evidenceText = fs.readFileSync(backupFile, 'utf8');
  let evidence;
  try { evidence = JSON.parse(evidenceText); } catch { fail(payload, 'Backup evidence no es JSON válido'); }
  const hasBackupFlag = evidence?.backupCreated === true || evidence?.ok === true || evidence?.backupVerified === true;
  if (!hasBackupFlag) fail(payload, 'Backup evidence no confirma backupCreated/ok/backupVerified');
  const actualBackupSha = createHash('sha256').update(fs.readFileSync(backupFile)).digest('hex');
  if (actualBackupSha !== expectedBackupSha) fail(payload, 'SHA256 de backup evidence no coincide');

  applyEnvFile(envFile);
  const missingDb = REQUIRED_DB_ENV.filter((k) => !process.env[k] || !String(process.env[k]).trim());
  if (missingDb.length > 0) fail(payload, `Faltan variables DB: ${missingDb.join(', ')}`);

  const mysql = await import('mysql2/promise');
  const conn = await mysql.createConnection({
    host: process.env.ADEIN_DB_HOST,
    port: Number(process.env.ADEIN_DB_PORT),
    user: process.env.ADEIN_DB_USER,
    password: process.env.ADEIN_DB_PASSWORD,
    database: process.env.ADEIN_DB_NAME
  });
  payload.databaseConnected = true;

  try {
    const syntheticToken = 'ADEIN_SYNTHETIC_V060_2026_05_25';
    const rawPayload = JSON.stringify({ synthetic: true, phase: 'v060', token: syntheticToken });
    const before = {};
    for (const t of ALLOWED_TABLES) before[t] = await countRows(conn, t);
    payload.rowCountsBefore = before;

    if (process.env.ADEIN_V060_REQUIRE_EMPTY_ALLOWED_TABLES === '1') {
      const nonZero = Object.entries(before).filter(([, c]) => c !== 0).map(([t]) => t);
      if (nonZero.length > 0) fail(payload, `Tablas no vacías: ${nonZero.join(', ')}`);
    }

    const dbName = process.env.ADEIN_DB_NAME;
    const tableColumns = {};
    for (const table of ALLOWED_TABLES) tableColumns[table] = await getColumns(conn, dbName, table);

    const matchesByTable = {};
    let totalMatches = 0;
    for (const table of ALLOWED_TABLES) {
      const searchableColumns = resolveTokenSearchableColumns(tableColumns[table]);
      const matchResult = await queryTokenMatchesInTable(conn, table, searchableColumns, syntheticToken);
      matchesByTable[table] = matchResult;
      totalMatches += matchResult.matchCount;
    }

    payload.existingSyntheticTokenCheck = { checked: true, syntheticToken, matchesByTable, totalMatches, passed: totalMatches === 0 };
    if (totalMatches > 0) {
      payload.syntheticTokenAlreadyExists = true;
      fail(payload, 'Synthetic token already exists in allowed tables');
    }

    const fixtureByTable = {
      properties: {
        name: `PROPIEDAD SINTETICA V060 - NO REAL - ${syntheticToken}`,
        location: null,
        raw_payload_json: rawPayload
      },
      lots: {
        property_id: 0,
        lot_code: 'LOTE-SINTETICO-V060-NO-REAL-ADEIN-SYNTHETIC',
        total_price: null,
        raw_payload_json: rawPayload
      },
      clients: {
        full_name: `CLIENTE SINTETICO V060 - NO REAL - ${syntheticToken}`,
        email: 'cliente.sintetico.v060@example.invalid',
        notes: `TOKEN ${syntheticToken} - NO REAL`,
        raw_payload_json: rawPayload
      },
      contracts: {
        client_id: 0,
        lot_id: 0,
        contract_code: 'CONTRATO-SINTETICO-V060-NO-REAL-ADEIN-SYNTHETIC',
        total_amount: null,
        down_payment: null,
        balance_amount: null,
        raw_payload_json: rawPayload
      },
      payment_schedule: {
        contract_id: 0,
        installment_number: 1,
        due_date: '2030-01-01',
        expected_amount: 1,
        notes: `TOKEN ${syntheticToken} - NO REAL`,
        raw_payload_json: rawPayload
      }
    };

    payload.requiredColumnsByTable = {};
    payload.providedColumnsByTable = {};
    payload.missingRequiredColumnsByTable = {};
    payload.schemaValidationByTable = {};

    for (const table of ALLOWED_TABLES) {
      const requiredColumns = getRequiredColumns(tableColumns[table]);
      const providedColumns = Object.keys(fixtureByTable[table]);
      const missingRequiredColumns = validateRequiredColumns(requiredColumns, providedColumns);
      payload.requiredColumnsByTable[table] = requiredColumns;
      payload.providedColumnsByTable[table] = providedColumns;
      payload.missingRequiredColumnsByTable[table] = missingRequiredColumns;
      payload.schemaValidationByTable[table] = { passed: missingRequiredColumns.length === 0 };
      if (missingRequiredColumns.length > 0) fail(payload, `Schema mismatch on ${table}. Missing required columns: ${missingRequiredColumns.join(', ')}`);
    }

    await conn.beginTransaction();
    payload.transactionOpened = true;

    const propertyId = await insertRow(conn, 'properties', fixtureByTable.properties);
    payload.insertsExecuted += 1;

    fixtureByTable.lots.property_id = propertyId;
    const lotId = await insertRow(conn, 'lots', fixtureByTable.lots);
    payload.insertsExecuted += 1;

    const clientId = await insertRow(conn, 'clients', fixtureByTable.clients);
    payload.insertsExecuted += 1;

    fixtureByTable.contracts.client_id = clientId;
    fixtureByTable.contracts.lot_id = lotId;
    const contractId = await insertRow(conn, 'contracts', fixtureByTable.contracts);
    payload.insertsExecuted += 1;

    fixtureByTable.payment_schedule.contract_id = contractId;
    const paymentScheduleId = await insertRow(conn, 'payment_schedule', fixtureByTable.payment_schedule);
    payload.insertsExecuted += 1;

    await conn.commit();
    payload.commitAllowed = true;
    payload.commitExecuted = true;
    payload.persistentWriteExecuted = true;

    const after = {};
    for (const t of ALLOWED_TABLES) after[t] = await countRows(conn, t);
    payload.rowCountsAfter = after;
    payload.rowCountDelta = Object.fromEntries(ALLOWED_TABLES.map((t) => [t, after[t] - before[t]]));
    const expected = payload.expectedRowCountDelta;
    const mismatch = ALLOWED_TABLES.filter((t) => payload.rowCountDelta[t] !== expected[t]);
    if (mismatch.length > 0) {
      payload.postCommitFailure = true;
      fail(payload, `Delta inválido en: ${mismatch.join(', ')}. Falla post-commit, requiere revisión manual.`);
    }

    payload.rowCountsVerified = true;
    payload.syntheticToken = syntheticToken;
    payload.insertedIds = { propertyId, lotId, clientId, contractId, paymentScheduleId };
    out(payload, 0);
  } catch (e) {
    if (payload.transactionOpened && !payload.commitExecuted) {
      try {
        await conn.rollback();
        payload.rollbackExecuted = true;
      } catch {
        payload.rollbackExecuted = false;
      }
    }
    if (payload.commitExecuted) {
      payload.postCommitFailure = true;
    }
    fail(payload, e instanceof Error ? e.message : 'Error desconocido');
  } finally {
    await conn.end();
  }
}

run().catch((e) => fail(basePayload(), e instanceof Error ? e.message : 'Unexpected error'));
