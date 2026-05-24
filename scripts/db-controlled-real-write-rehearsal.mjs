#!/usr/bin/env node

const PHASE = 'v048';
const DEFAULT_MODE = 'controlled_real_write_rehearsal_dry_run';
const ROLLBACK_MODE = 'controlled_real_write_rehearsal_rollback_only';
const TABLES_IN_SCOPE = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const TABLES_BLOCKED = ['crm_users', 'sellers', 'crm_followups', 'import_batches', 'import_raw_rows', 'migration_plans', 'migration_plan_events', 'audit_log'];

const BLOCKED_RULES = [
  { key: 'ADEIN_DB_COMMIT', blocked: ['1'], reason: 'ADEIN_DB_COMMIT=1 is forbidden.' },
  { key: 'ADEIN_DB_ALLOW_PERSISTENT_WRITE', blocked: ['1'], reason: 'ADEIN_DB_ALLOW_PERSISTENT_WRITE=1 is forbidden.' },
  { key: 'ADEIN_DB_ENABLE_WRITES', blocked: ['1'], reason: 'ADEIN_DB_ENABLE_WRITES=1 is forbidden.' },
  { key: 'ADEIN_DB_MODE', blocked: ['write', 'read_write'], reason: 'ADEIN_DB_MODE write/read_write is forbidden.' },
  { key: 'ADEIN_DB_WRITE_GATE', blocked: ['REAL_COMMIT'], reason: 'ADEIN_DB_WRITE_GATE=REAL_COMMIT is forbidden.' }
];

const REQUIRED_GATES = {
  ADEIN_DB_MODE: 'rollback_only',
  ADEIN_DB_ROLLBACK_ONLY: '1',
  ADEIN_DB_WRITE_GATE: 'V048_ROLLBACK_REHEARSAL',
  ADEIN_DB_APPROVAL_TOKEN: 'APPROVE_V048_ROLLBACK_REHEARSAL'
};

const REQUIRED_DB_ENV = ['ADEIN_DB_HOST', 'ADEIN_DB_PORT', 'ADEIN_DB_USER', 'ADEIN_DB_PASSWORD', 'ADEIN_DB_NAME'];

const REQUIRED_COLUMNS = {
  properties: ['name'],
  clients: ['full_name'],
  lots: ['property_id', 'lot_code'],
  contracts: ['client_id', 'lot_id', 'contract_code'],
  payment_schedule: ['contract_id', 'installment_number', 'due_date', 'expected_amount']
};

const ts = Date.now();
const token = `ADEIN_V048_ROLLBACK_REHEARSAL_${ts}`;

const FIXTURE_VALUES = {
  properties: { name: `${token}_PROPERTY`, code: `${token}_PROP`, description: 'Synthetic rollback rehearsal fixture' },
  clients: { full_name: `${token}_CLIENT`, email: `${token.toLowerCase()}@invalid.local`, notes: 'Synthetic rollback rehearsal fixture' },
  lots: { lot_code: `${token}_LOT`, status: 'synthetic_rehearsal' },
  contracts: { contract_code: `${token}_CONTRACT`, status: 'synthetic_rehearsal' },
  payment_schedule: { installment_number: 1, due_date: '2099-12-31', expected_amount: 1.01, status: 'synthetic_rehearsal' }
};

const normalize = (v) => String(v ?? '').trim().toLowerCase();

function jsonExit(payload, code = 0) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(code);
}

function detectBlocked(env) {
  for (const rule of BLOCKED_RULES) {
    if (env[rule.key] === undefined) continue;
    if (rule.blocked.map(normalize).includes(normalize(env[rule.key]))) {
      return { key: rule.key, value: String(env[rule.key]), reason: rule.reason };
    }
  }
  return null;
}

function hasAllRollbackGates(env) {
  return Object.entries(REQUIRED_GATES).every(([k, v]) => normalize(env[k]) === normalize(v));
}

function defaultDryRun() {
  return {
    ok: true,
    phase: PHASE,
    mode: DEFAULT_MODE,
    dryRun: true,
    rollbackOnly: true,
    commitAllowed: false,
    commitExecuted: false,
    persistentWriteExecuted: false,
    realDataUsed: false,
    credentialsRequired: false,
    humanApprovalRequired: true,
    approvalGateRequired: true,
    backupVerificationRequired: true,
    snapshotBeforeRequired: true,
    snapshotAfterRequired: true,
    tablesInScope: TABLES_IN_SCOPE,
    tablesBlocked: TABLES_BLOCKED,
    nextRecommendedPhase: 'v049-controlled-persistent-write-candidate-minimum-safe-commit-planning'
  };
}

async function runRollbackOnly(env) {
  const missingDbEnv = REQUIRED_DB_ENV.filter((key) => !String(env[key] ?? '').trim());
  if (missingDbEnv.length) {
    jsonExit({ ok: false, phase: PHASE, mode: ROLLBACK_MODE, reason: 'Missing database env vars.', missingDbEnv, commitExecuted: false, persistentWriteExecuted: false }, 1);
  }

  const mysql = await import('mysql2/promise');
  const connection = await mysql.createConnection({
    host: env.ADEIN_DB_HOST,
    port: Number(env.ADEIN_DB_PORT),
    user: env.ADEIN_DB_USER,
    password: env.ADEIN_DB_PASSWORD,
    database: env.ADEIN_DB_NAME
  });

  let rollbackExecuted = false;
  let insertedRowsAttempted = 0;
  const evidence = { token, insertions: [], rollbackTokenCheck: {} };

  try {
    await connection.beginTransaction();

    const ids = {};
    for (const table of ['properties', 'clients', 'lots', 'contracts', 'payment_schedule']) {
      const [colsRows] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [env.ADEIN_DB_NAME, table]
      );
      const columns = colsRows.map((r) => r.COLUMN_NAME);
      const missingRequired = REQUIRED_COLUMNS[table].filter((c) => !columns.includes(c));
      if (missingRequired.length) {
        throw new Error(`Table ${table} missing required columns: ${missingRequired.join(', ')}`);
      }

      const row = { ...FIXTURE_VALUES[table] };
      if (table === 'lots') row.property_id = ids.properties;
      if (table === 'contracts') {
        row.client_id = ids.clients;
        row.lot_id = ids.lots;
      }
      if (table === 'payment_schedule') row.contract_id = ids.contracts;

      const allowedEntries = Object.entries(row).filter(([k]) => columns.includes(k));
      const insertCols = allowedEntries.map(([k]) => k);
      const insertVals = allowedEntries.map(([, v]) => v);
      const placeholders = insertCols.map(() => '?').join(', ');
      const sql = `INSERT INTO ${table} (${insertCols.join(', ')}) VALUES (${placeholders})`;
      const [result] = await connection.execute(sql, insertVals);
      insertedRowsAttempted += 1;
      ids[table] = result.insertId;
      evidence.insertions.push({ table, insertId: result.insertId, insertedColumns: insertCols });
    }
  } catch (error) {
    try {
      await connection.rollback();
      rollbackExecuted = true;
    } catch {}
    await connection.end();
    jsonExit({ ok: false, phase: PHASE, mode: ROLLBACK_MODE, rollbackExecuted, commitExecuted: false, persistentWriteExecuted: false, insertedRowsAttempted, error: error.message }, 1);
  }

  await connection.rollback();
  rollbackExecuted = true;

  const tablesChecked = ['properties', 'clients', 'lots', 'contracts', 'payment_schedule'];
  for (const table of tablesChecked) {
    const [rows] = await connection.execute(`SELECT COUNT(*) AS count FROM ${table} WHERE CONCAT_WS('', ${table === 'properties' ? 'name' : table === 'clients' ? 'full_name' : table === 'lots' ? 'lot_code' : table === 'contracts' ? 'contract_code' : 'contract_id'}, '') LIKE ?`, [`%${token}%`]);
    evidence.rollbackTokenCheck[table] = rows[0]?.count ?? 0;
  }

  await connection.end();

  jsonExit({
    ok: Object.values(evidence.rollbackTokenCheck).every((count) => count === 0),
    phase: PHASE,
    mode: ROLLBACK_MODE,
    rollbackExecuted,
    commitExecuted: false,
    persistentWriteExecuted: false,
    insertedRowsAttempted,
    verificationAfterRollback: evidence.rollbackTokenCheck,
    tablesChecked,
    evidence,
    warnings: ['Rollback-only rehearsal executed with synthetic fixture only.']
  }, Object.values(evidence.rollbackTokenCheck).every((count) => count === 0) ? 0 : 1);
}

async function main() {
  const blocked = detectBlocked(process.env);
  if (blocked) {
    jsonExit({ ok: false, phase: PHASE, mode: 'blocked_dangerous_write_gate', reason: blocked.reason, rejectedSignal: blocked, commitExecuted: false, persistentWriteExecuted: false }, 1);
  }

  const rollbackRequested = normalize(process.env.ADEIN_DB_MODE) === 'rollback_only' || process.env.ADEIN_DB_ROLLBACK_ONLY === '1';
  if (!rollbackRequested) {
    jsonExit(defaultDryRun(), 0);
  }

  if (!hasAllRollbackGates(process.env)) {
    jsonExit({ ok: false, phase: PHASE, mode: ROLLBACK_MODE, reason: 'Missing one or more explicit rollback-only gates.', gatesRequired: REQUIRED_GATES, commitExecuted: false, persistentWriteExecuted: false }, 1);
  }

  await runRollbackOnly(process.env);
}

main();
