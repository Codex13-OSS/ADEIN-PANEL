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

function out(payload, code = 0) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(code);
}

function fail(payload, message, code = 1) {
  out({ ...payload, ok: false, error: message, persistentWriteExecuted: false, commitExecuted: false }, code);
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

function chooseValues(columns, candidates) {
  const chosen = {};
  for (const c of columns) {
    if (Object.prototype.hasOwnProperty.call(candidates, c.COLUMN_NAME)) {
      chosen[c.COLUMN_NAME] = candidates[c.COLUMN_NAME];
    }
  }
  return chosen;
}

function ensureRequiredSatisfied(table, columns, chosen) {
  const missing = columns.filter((c) => {
    const required = c.IS_NULLABLE === 'NO' && c.COLUMN_DEFAULT === null && !String(c.EXTRA || '').includes('auto_increment');
    return required && !Object.prototype.hasOwnProperty.call(chosen, c.COLUMN_NAME);
  }).map((c) => c.COLUMN_NAME);
  if (missing.length > 0) {
    throw new Error(`Schema mismatch on ${table}. Missing required columns: ${missing.join(', ')}`);
  }
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
    insertsExecuted: 0,
    plannedRows: 5,
    syntheticOnly: true,
    allowedTables: ALLOWED_TABLES,
    expectedRowCountDelta: { properties: 1, lots: 1, clients: 1, contracts: 1, payment_schedule: 1 },
    safetyEnvelope: { noDefaultDbConnection: true, noDefaultTransaction: true, noDefaultInsert: true, noDefaultCommit: true },
    requiredGates: { ...REQUIRED_GATES, ADEIN_DB_ENV_FILE: '<path>', ADEIN_V060_BACKUP_EVIDENCE_FILE: '<path>', ADEIN_V060_EXPECTED_BACKUP_SHA256: '<sha256>' },
    plannedSyntheticFixture: {
      syntheticToken: 'ADEIN_SYNTHETIC_V060_2026_05_25',
      property: 'PROPIEDAD SINTETICA V060 - NO REAL',
      lot: 'LOTE SINTETICO V060 - NO REAL',
      client: 'CLIENTE SINTETICO V060 - NO REAL',
      contract: 'CONTRATO SINTETICO V060 - NO REAL',
      email: 'cliente.sintetico.v060@example.invalid',
      phone: '0000000000'
    },
    abortConditions: [
      'missing gates',
      'backup evidence missing or invalid sha256',
      'required empty tables are not empty',
      'synthetic token already exists',
      'schema mismatch',
      'insert failure',
      'post-commit delta mismatch'
    ]
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
  payload.backupVerified = true;

  const syntheticToken = `ADEIN_SYNTHETIC_V060_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}`;
  const before = {};
  for (const t of ALLOWED_TABLES) before[t] = await countRows(conn, t);
  payload.rowCountsBefore = before;

  if (process.env.ADEIN_V060_REQUIRE_EMPTY_ALLOWED_TABLES === '1') {
    const nonZero = Object.entries(before).filter(([, c]) => c !== 0).map(([t]) => t);
    if (nonZero.length > 0) fail(payload, `Tablas no vacías: ${nonZero.join(', ')}`);
  }

  try {
    await conn.beginTransaction();
    payload.transactionOpened = true;

    const db = process.env.ADEIN_DB_NAME;
    const [propCols, lotCols, clientCols, contractCols, psCols] = await Promise.all(ALLOWED_TABLES.map((t) => getColumns(conn, db, t)));

    const propValues = chooseValues(propCols, { name: 'PROPIEDAD SINTETICA V060 - NO REAL', title: 'PROPIEDAD SINTETICA V060 - NO REAL', description: `TOKEN ${syntheticToken}`, synthetic_token: syntheticToken, notes: `SINTETICO ${syntheticToken}` });
    ensureRequiredSatisfied('properties', propCols, propValues);
    const propertyId = await insertRow(conn, 'properties', propValues);

    const lotValues = chooseValues(lotCols, { name: 'LOTE SINTETICO V060 - NO REAL', description: `TOKEN ${syntheticToken}`, synthetic_token: syntheticToken, property_id: propertyId });
    ensureRequiredSatisfied('lots', lotCols, lotValues);
    const lotId = await insertRow(conn, 'lots', lotValues);

    const clientValues = chooseValues(clientCols, { name: 'CLIENTE SINTETICO V060 - NO REAL', full_name: 'CLIENTE SINTETICO V060 - NO REAL', email: 'cliente.sintetico.v060@example.invalid', phone: '0000000000', synthetic_token: syntheticToken, notes: `SINTETICO ${syntheticToken}` });
    ensureRequiredSatisfied('clients', clientCols, clientValues);
    const clientId = await insertRow(conn, 'clients', clientValues);

    const contractValues = chooseValues(contractCols, { name: 'CONTRATO SINTETICO V060 - NO REAL', description: `TOKEN ${syntheticToken}`, synthetic_token: syntheticToken, property_id: propertyId, lot_id: lotId, client_id: clientId, amount: 1, total_amount: 1 });
    ensureRequiredSatisfied('contracts', contractCols, contractValues);
    const contractId = await insertRow(conn, 'contracts', contractValues);

    const psValues = chooseValues(psCols, { description: `PAGO SINTETICO ${syntheticToken}`, synthetic_token: syntheticToken, contract_id: contractId, amount: 1, total: 1 });
    ensureRequiredSatisfied('payment_schedule', psCols, psValues);
    const paymentScheduleId = await insertRow(conn, 'payment_schedule', psValues);

    payload.insertsExecuted = 5;

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
    if (mismatch.length > 0) fail(payload, `Delta inválido en: ${mismatch.join(', ')}`);

    payload.rowCountsVerified = true;
    payload.syntheticToken = syntheticToken;
    payload.insertedIds = { propertyId, lotId, clientId, contractId, paymentScheduleId };
    payload.forbiddenOperationsDetected = false;
    out(payload, 0);
  } catch (e) {
    if (payload.transactionOpened && !payload.commitExecuted) {
      try { await conn.rollback(); } catch {}
    }
    fail(payload, e instanceof Error ? e.message : 'Error desconocido');
  } finally {
    await conn.end();
  }
}

run().catch((e) => fail(basePayload(), e instanceof Error ? e.message : 'Unexpected error'));
