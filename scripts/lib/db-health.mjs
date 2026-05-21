import { createDbConnection, loadDbConfig } from './db-connection.mjs';

const EXPECTED_TABLES = [
  'audit_log',
  'clients',
  'contracts',
  'crm_followups',
  'crm_users',
  'import_batches',
  'import_raw_rows',
  'lots',
  'migration_plan_events',
  'migration_plans',
  'payment_schedule',
  'properties',
  'sellers'
];

export async function getDbHealthSnapshot() {
  const config = loadDbConfig();
  const connection = await createDbConnection(config);

  try {
    const [databaseRows] = await connection.query('SELECT DATABASE() AS active_database');
    const activeDatabase = databaseRows[0]?.active_database ?? null;

    const [tableCountRows] = await connection.query(
      'SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema = ?',
      [config.database]
    );
    const tablesFound = Number(tableCountRows[0]?.table_count ?? 0);

    const [existingTableRows] = await connection.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name IN (${EXPECTED_TABLES.map(() => '?').join(',')})`,
      [config.database, ...EXPECTED_TABLES]
    );

    const existingTables = new Set(existingTableRows.map((row) => row.table_name));
    const missingTables = EXPECTED_TABLES.filter((table) => !existingTables.has(table));

    const rowCounts = {};
    for (const table of EXPECTED_TABLES) {
      if (!existingTables.has(table)) continue;
      const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
      rowCounts[table] = Number(rows[0]?.total ?? 0);
    }

    const nonEmptyTables = Object.entries(rowCounts)
      .filter(([, count]) => count > 0)
      .map(([table]) => table);

    let status = 'ok';
    if (missingTables.length > 0 || activeDatabase !== config.database) {
      status = 'error';
    } else if (nonEmptyTables.length > 0 || tablesFound !== EXPECTED_TABLES.length) {
      status = 'warning';
    }

    return {
      ok: status !== 'error',
      status,
      database: activeDatabase,
      expectedDatabase: config.database,
      tablesExpected: EXPECTED_TABLES.length,
      tablesFound,
      missingTables,
      rowCounts,
      nonEmptyTables,
      mode: 'read_only',
      writesEnabled: false
    };
  } finally {
    await connection.end();
  }
}
