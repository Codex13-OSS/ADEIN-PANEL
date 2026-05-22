#!/usr/bin/env node

const PHASE = 'v041';
const ALLOWED_TABLES = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const REQUIRED_GATES = {
  ADEIN_DB_ROLLBACK_LIVE_TEST: '1',
  ADEIN_DB_WRITE_GATE: 'ROLLBACK_ONLY_V041',
  ADEIN_DB_ALLOW_DEMO_REHEARSAL_ROWS: '1'
};
const REQUIRED_CONN_VARS = ['ADEIN_DB_HOST', 'ADEIN_DB_PORT', 'ADEIN_DB_USER', 'ADEIN_DB_PASSWORD', 'ADEIN_DB_NAME'];

function basePayload() {
  return {
    ok: true,
    phase: PHASE,
    mode: 'dry_run',
    databaseMode: 'none',
    liveTestEnabled: false,
    writesEnabled: false,
    rollbackRequired: false,
    rollbackExecuted: false,
    commitAllowed: false,
    commitExecuted: false
  };
}

function hasDbGates() {
  return Object.entries(REQUIRED_GATES).every(([k, v]) => process.env[k] === v);
}

function hasConnVars() {
  return REQUIRED_CONN_VARS.every((k) => !!process.env[k]);
}

const TABLE_TEXT_COLUMNS_WHITELIST = {
  clients: ['full_name', 'phone', 'email', 'status', 'source', 'notes'],
  properties: ['name', 'location', 'status'],
  lots: ['lot_code', 'status', 'currency'],
  contracts: ['contract_code', 'contract_status', 'source_doc_id', 'currency'],
  payment_schedule: ['payment_status', 'notes']
};

function buildTableSearchCondition(table, columns) {
  const allowedColumns = TABLE_TEXT_COLUMNS_WHITELIST[table] || [];
  const existingColumns = new Set(columns.map((c) => String(c.COLUMN_NAME || '').toLowerCase()));
  const usableColumns = allowedColumns.filter((col) => existingColumns.has(col.toLowerCase()));

  if (!usableColumns.length) {
    return {
      sql: '1=0',
      params: [],
      skipped: true,
      reason: 'no_schema_aware_search_columns'
    };
  }

  const expr = usableColumns.map((col) => `COALESCE(${col}, '')`).join(", ");
  return {
    sql: `CONCAT_WS(' ', ${expr}) LIKE ?`,
    params: ['__TOKEN_LIKE__'],
    skipped: false,
    usedColumns: usableColumns
  };
}

async function getTableMeta(connection, dbName, table) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [dbName, table]
  );
  return rows;
}

function canPopulate(col) {
  const isAuto = String(col.EXTRA || '').toLowerCase().includes('auto_increment');
  const hasDefault = col.COLUMN_DEFAULT !== null;
  return !isAuto && !hasDefault;
}

function buildDemoValue(table, column, token, ids) {
  const c = column.toLowerCase();
  if (c === 'id') return undefined;
  if (c.endsWith('_id')) {
    if (table === 'properties' && c === 'client_id') return ids.clients;
    if (table === 'lots' && c === 'property_id') return ids.properties;
    if (table === 'contracts' && c === 'client_id') return ids.clients;
    if (table === 'contracts' && c === 'lot_id') return ids.lots;
    if (table === 'payment_schedule' && c === 'contract_id') return ids.contracts;
  }
  if (['email'].includes(c)) return `demo+${token}@example.invalid`;
  if (['name', 'full_name', 'client_name', 'owner_name', 'title', 'description', 'notes', 'status', 'code', 'reference', 'contract_code', 'lot_code', 'property_name', 'location', 'currency', 'payment_status', 'contract_status', 'source_doc_id', 'source'].includes(c)) return `ADEIN_V041_ROLLBACK_TEST_${table}_${token}`;
  if (['phone', 'phone_number'].includes(c)) return '0000000000';
  if (c.includes('date')) return '2026-12-31';
  if (c.includes('amount') || c.includes('price') || c.includes('total') || c.includes('balance')) return 1;
  if (['active', 'enabled', 'is_active'].includes(c)) return 1;
  return undefined;
}

async function countTokenRows(connection, dbName, tokenLike) {
  const countsByTable = {};
  const tableVerification = {};
  let total = 0;

  for (const table of ALLOWED_TABLES) {
    const meta = await getTableMeta(connection, dbName, table);
    const search = buildTableSearchCondition(table, meta);
    if (search.skipped) {
      countsByTable[table] = 0;
      tableVerification[table] = { skipped: true, reason: search.reason };
      continue;
    }

    const params = search.params.map((p) => (p === '__TOKEN_LIKE__' ? tokenLike : p));
    const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM ${table} WHERE ${search.sql}`, params);
    const tableTotal = Number(rows?.[0]?.total || 0);
    countsByTable[table] = tableTotal;
    total += tableTotal;
    tableVerification[table] = { skipped: false, usedColumns: search.usedColumns };
  }

  return { total, countsByTable, tableVerification };
}

async function transactionalLiveTest() {
  const payload = basePayload();
  payload.mode = 'db_rollback_live_test';
  payload.databaseMode = 'rollback_only';
  payload.liveTestEnabled = true;
  payload.writesEnabled = true;
  payload.rollbackRequired = true;

  const { default: mysql } = await import('mysql2/promise');
  const connection = await mysql.createConnection({
    host: process.env.ADEIN_DB_HOST,
    port: Number(process.env.ADEIN_DB_PORT),
    user: process.env.ADEIN_DB_USER,
    password: process.env.ADEIN_DB_PASSWORD,
    database: process.env.ADEIN_DB_NAME
  });

  const token = `REHEARSAL_V041_ADEIN_V041_ROLLBACK_TEST_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tokenLike = `%${token}%`;
  const ids = { clients: null, properties: null, lots: null, contracts: null, payment_schedule: null };
  const inserted = [];
  let rollbackExecuted = false;

  try {
    const [dbRows] = await connection.query('SELECT DATABASE() AS current_db');
    const currentDb = dbRows?.[0]?.current_db || null;
    if (!currentDb || currentDb !== process.env.ADEIN_DB_NAME) {
      throw new Error('database_name_validation_failed');
    }

    for (const table of ALLOWED_TABLES) {
      const meta = await getTableMeta(connection, process.env.ADEIN_DB_NAME, table);
      if (!meta.length) throw new Error(`table_metadata_not_found:${table}`);
    }

    const beforeSnapshot = await countTokenRows(connection, process.env.ADEIN_DB_NAME, tokenLike);

    await connection.beginTransaction();

    for (const table of ALLOWED_TABLES) {
      const meta = await getTableMeta(connection, process.env.ADEIN_DB_NAME, table);
      const cols = [];
      const vals = [];

      for (const col of meta) {
        if (!canPopulate(col)) continue;
        const value = buildDemoValue(table, col.COLUMN_NAME, token, ids);
        if (value !== undefined) {
          cols.push(col.COLUMN_NAME);
          vals.push(value);
        } else if (col.IS_NULLABLE === 'YES') {
          cols.push(col.COLUMN_NAME);
          vals.push(null);
        }
      }

      if (!cols.length) throw new Error(`no_insertable_columns:${table}`);

      const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
      const [result] = await connection.execute(sql, vals);
      ids[table] = result.insertId || ids[table];
      inserted.push({ table, insertId: result.insertId || null });
    }

    await connection.rollback();
    rollbackExecuted = true;

    const afterSnapshot = await countTokenRows(connection, process.env.ADEIN_DB_NAME, tokenLike);

    return {
      ...payload,
      rollbackExecuted,
      persistedRowsAfterRollback: afterSnapshot.total,
      tablesChecked: ALLOWED_TABLES,
      evidence: {
        token,
        beforeCounts: beforeSnapshot.countsByTable,
        afterCounts: afterSnapshot.countsByTable,
        insertedTables: inserted.map((x) => x.table),
        tableVerification: afterSnapshot.tableVerification
      }
    };
  } finally {
    if (!rollbackExecuted) {
      try {
        await connection.rollback();
        rollbackExecuted = true;
      } catch {
        // no-op: rollback best effort in failure path
      }
    }
    await connection.end();
  }
}

async function run() {
  const payload = basePayload();
  const dbRequested = process.env.ADEIN_DB_ROLLBACK_LIVE_TEST === '1' || process.env.ADEIN_DB_WRITE_GATE === 'ROLLBACK_ONLY_V041';

  if (!dbRequested) return payload;

  if (!hasDbGates()) {
    return {
      ...payload,
      ok: false,
      mode: 'rejected',
      databaseMode: 'blocked',
      reason: 'missing_explicit_rollback_live_test_gates'
    };
  }

  if (!hasConnVars()) {
    return {
      ...payload,
      ok: false,
      mode: 'rejected',
      databaseMode: 'blocked',
      reason: 'missing_db_connection_env_vars'
    };
  }

  return transactionalLiveTest();
}

run()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    const result = {
      ...basePayload(),
      ok: false,
      mode: 'error',
      databaseMode: 'blocked',
      reason: error?.message || 'unknown_error'
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  });
