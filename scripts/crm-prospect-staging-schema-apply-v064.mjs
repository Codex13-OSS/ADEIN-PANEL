#!/usr/bin/env node
import fs from 'node:fs';
import { resolve } from 'node:path';

const PHASE = 'v064';
const MODE_DRY = 'dry_run';
const MODE_APPLY = 'controlled_apply_staging';
const SCHEMA_FILE = 'docs/db/003_crm_prospect_staging_schema_v063.sql';
const ALLOWED_TABLES = [
  'lead_sources',
  'prospects',
  'whatsapp_conversations',
  'whatsapp_analyses',
  'prospect_followups',
  'crm_history_events'
];
const FORBIDDEN_PATTERNS = [
  'DROP', 'TRUNCATE', 'DELETE', 'UPDATE', 'INSERT', 'REPLACE', 'CREATE DATABASE', 'USE', 'GRANT', 'ALTER USER', 'DROP USER', 'SET PASSWORD'
];

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

function basePayload() {
  return {
    ok: true,
    phase: PHASE,
    mode: MODE_DRY,
    dryRun: true,
    databaseConnectionAttempted: false,
    schemaFile: SCHEMA_FILE,
    allowedTables: ALLOWED_TABLES,
    detectedTables: [],
    forbiddenPatternsDetected: [],
    applyPlan: [],
    verificationPlan: [],
    rollbackNotes: [
      'DDL en MariaDB/MySQL no garantiza rollback transaccional completo.',
      'Rollback debe ser manual y controlado con respaldo previo/restauración o DDL inverso revisado.',
      'Este script NO ejecuta DROP automático para rollback.'
    ],
    safetyEnvelope: {
      defaultMode: MODE_DRY,
      requiresExplicitGates: ['ADEIN_CRM_PROSPECT_STAGING_SCHEMA_APPLY_V064=1', 'ADEIN_DB_ENV_FILE', 'ADEIN_DB_TARGET=staging'],
      blockedSignals: ['NODE_ENV=production', 'ADEIN_DB_TARGET=production', 'ADEIN_DB_ENV=production', 'ADEIN_DB_COMMIT=1', 'ADEIN_DB_ALLOW_PERSISTENT_WRITE=1', 'ADEIN_DB_ENABLE_WRITES=1'],
      businessTablesExcluded: ['clients', 'contracts', 'payment_schedule', 'lots']
    }
  };
}

function fail(payload, error, code = 1) {
  process.stdout.write(`${JSON.stringify({ ...payload, ok: false, error }, null, 2)}\n`);
  process.exit(code);
}

function analyzeSql(sqlText) {
  const statements = sqlText
    .split(';')
    .map((s) => s.replace(/--.*$/gm, '').trim())
    .filter(Boolean);

  const forbiddenPatternsDetected = [];
  for (const stmt of statements) {
    for (const token of FORBIDDEN_PATTERNS) {
      const starter = new RegExp(`^${token.replace(/\s+/g, '\\s+')}\b`, 'i');
      if (starter.test(stmt)) forbiddenPatternsDetected.push(token);
    }
  }

  const createMatches = [...sqlText.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`?([a-zA-Z0-9_]+)`?/gi)];
  const detectedTables = [...new Set(createMatches.map((m) => m[1]))];
  const outsideAllowlist = detectedTables.filter((t) => !ALLOWED_TABLES.includes(t));
  return { forbiddenPatternsDetected: [...new Set(forbiddenPatternsDetected)], detectedTables, outsideAllowlist };
}

async function main() {
  const payload = basePayload();
  const schemaPath = resolve(process.cwd(), SCHEMA_FILE);
  if (!fs.existsSync(schemaPath)) fail(payload, `Schema file not found: ${SCHEMA_FILE}`);

  const sqlText = fs.readFileSync(schemaPath, 'utf8');
  const analysis = analyzeSql(sqlText);
  payload.detectedTables = analysis.detectedTables;
  payload.forbiddenPatternsDetected = analysis.forbiddenPatternsDetected;

  if (analysis.forbiddenPatternsDetected.length > 0) fail(payload, `Forbidden SQL patterns detected: ${analysis.forbiddenPatternsDetected.join(', ')}`);
  if (analysis.outsideAllowlist.length > 0) fail(payload, `Tables outside allowlist: ${analysis.outsideAllowlist.join(', ')}`);
  if (ALLOWED_TABLES.some((t) => !payload.detectedTables.includes(t))) {
    fail(payload, 'Detected tables do not include full expected allowlist');
  }

  payload.applyPlan = [
    '1) Validar gates y señales de abort.',
    '2) Cargar ADEIN_DB_ENV_FILE y abrir conexión solo staging.',
    '3) Ejecutar SQL v063 permitido (solo CREATE TABLE IF NOT EXISTS allowlist).',
    '4) Verificar existencia de tablas allowlist.',
    '5) Reportar row counts de tablas allowlist sin insertar datos.'
  ];
  payload.verificationPlan = [
    'SHOW TABLES/INFORMATION_SCHEMA para confirmar tablas permitidas.',
    'SELECT COUNT(*) por cada tabla permitida (idealmente 0 en staging limpio).',
    'Confirmar no afectación de clients/contracts/payment_schedule/lots.'
  ];

  const applyEnabled = process.env.ADEIN_CRM_PROSPECT_STAGING_SCHEMA_APPLY_V064 === '1';
  if (!applyEnabled) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  payload.mode = MODE_APPLY;
  payload.dryRun = false;

  const dangerousEnv = (
    process.env.NODE_ENV === 'production' ||
    process.env.ADEIN_DB_TARGET === 'production' ||
    process.env.ADEIN_DB_ENV === 'production' ||
    process.env.ADEIN_DB_COMMIT === '1' ||
    process.env.ADEIN_DB_ALLOW_PERSISTENT_WRITE === '1' ||
    process.env.ADEIN_DB_ENABLE_WRITES === '1'
  );
  if (dangerousEnv) fail(payload, 'Abortado por señales de producción/persistencia peligrosa');

  if (process.env.ADEIN_DB_TARGET !== 'staging') fail(payload, 'ADEIN_DB_TARGET debe ser staging');
  const envFile = process.env.ADEIN_DB_ENV_FILE;
  if (!envFile || !fs.existsSync(envFile)) fail(payload, 'ADEIN_DB_ENV_FILE faltante o inexistente');

  parseEnvFile(envFile);
  const requiredDb = ['ADEIN_DB_HOST', 'ADEIN_DB_PORT', 'ADEIN_DB_NAME', 'ADEIN_DB_USER', 'ADEIN_DB_PASSWORD'];
  const missing = requiredDb.filter((k) => !process.env[k]);
  if (missing.length > 0) fail(payload, `Faltan variables DB: ${missing.join(', ')}`);

  payload.databaseConnectionAttempted = true;
  const mysql = await import('mysql2/promise');
  const connection = await mysql.default.createConnection({
    host: process.env.ADEIN_DB_HOST,
    port: Number(process.env.ADEIN_DB_PORT),
    user: process.env.ADEIN_DB_USER,
    password: process.env.ADEIN_DB_PASSWORD,
    database: process.env.ADEIN_DB_NAME,
    connectTimeout: 8000,
    multipleStatements: true
  });

  try {
    await connection.query('SELECT 1 AS ok');
    if ((process.env.ADEIN_DB_ENV || '').toLowerCase() === 'production') fail(payload, 'ADEIN_DB_ENV no puede ser production en apply');

    await connection.query(sqlText);

    const [tableRows] = await connection.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${ALLOWED_TABLES.map(() => '?').join(',')})`,
      [process.env.ADEIN_DB_NAME, ...ALLOWED_TABLES]
    );
    const existing = new Set(tableRows.map((r) => r.TABLE_NAME));
    const missingTables = ALLOWED_TABLES.filter((t) => !existing.has(t));
    if (missingTables.length > 0) fail(payload, `Faltan tablas post-apply: ${missingTables.join(', ')}`);

    const rowCounts = {};
    for (const table of ALLOWED_TABLES) {
      const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      rowCounts[table] = Number(rows?.[0]?.count ?? -1);
    }

    payload.rowCounts = rowCounts;
    payload.applied = true;
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  process.stdout.write(`${JSON.stringify({ ok: false, phase: PHASE, mode: 'error', error: error?.message || String(error) }, null, 2)}\n`);
  process.exit(1);
});
