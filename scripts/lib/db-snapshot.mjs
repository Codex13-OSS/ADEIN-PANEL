import { createDbConnection, loadDbConfig } from './db-connection.mjs';

function rowsToStatusMap(rows, key = 'status') {
  return rows.reduce((acc, row) => {
    const raw = row?.[key];
    const status = raw == null || String(raw).trim() === '' ? 'unknown' : String(raw);
    acc[status] = Number(row?.total ?? 0);
    return acc;
  }, {});
}

async function getCount(connection, table) {
  const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
  return Number(rows[0]?.total ?? 0);
}

function buildSummaryCard(label, value, extra = {}) {
  return { label, value, ...extra, status: value > 0 ? 'ok' : 'empty' };
}

const SYNTHETIC_TOKEN_V060 = 'ADEIN_SYNTHETIC_V060_2026_05_25';

function buildSyntheticWhereClause() {
  return `(
    COALESCE(synthetic_token, '') = ?
    OR COALESCE(raw_payload_json, '') LIKE ?
    OR COALESCE(notes, '') LIKE ?
    OR COALESCE(name, '') LIKE ?
    OR COALESCE(full_name, '') LIKE ?
    OR COALESCE(contract_code, '') LIKE ?
    OR COALESCE(lot_code, '') LIKE ?
  )`;
}

function syntheticParams() {
  return [
    SYNTHETIC_TOKEN_V060,
    `%${SYNTHETIC_TOKEN_V060}%`,
    `%${SYNTHETIC_TOKEN_V060}%`,
    `%${SYNTHETIC_TOKEN_V060}%`,
    `%${SYNTHETIC_TOKEN_V060}%`,
    `%${SYNTHETIC_TOKEN_V060}%`,
    `%${SYNTHETIC_TOKEN_V060}%`
  ];
}

async function getSyntheticCount(connection, table) {
  const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM ${table} WHERE ${buildSyntheticWhereClause()}`, syntheticParams());
  return Number(rows[0]?.total ?? 0);
}

async function getSyntheticRow(connection, table, fields) {
  const [rows] = await connection.query(`SELECT ${fields.join(', ')} FROM ${table} WHERE ${buildSyntheticWhereClause()} ORDER BY id ASC LIMIT 1`, syntheticParams());
  return rows[0] ?? null;
}

export async function getDbReadonlySnapshot() {
  const config = loadDbConfig();
  const connection = await createDbConnection(config);
  try {
    const [databaseRows] = await connection.query('SELECT DATABASE() AS active_database');
    const activeDatabase = databaseRows[0]?.active_database ?? null;
    const counts = {
      clients: await getCount(connection, 'clients'),
      lots: await getCount(connection, 'lots'),
      contracts: await getCount(connection, 'contracts')
    };

    const [clientsByStatusRows] = await connection.query('SELECT status, COUNT(*) AS total FROM clients GROUP BY status');
    const [lotsByStatusRows] = await connection.query('SELECT status, COUNT(*) AS total FROM lots GROUP BY status');
    const [contractsByStatusRows] = await connection.query('SELECT contract_status AS status, COUNT(*) AS total FROM contracts GROUP BY contract_status');

    const [collectionRows] = await connection.query(`SELECT
        COALESCE(SUM(expected_amount), 0) AS expected_total,
        COALESCE(SUM(paid_amount), 0) AS paid_total,
        COALESCE(SUM(expected_amount), 0) - COALESCE(SUM(paid_amount), 0) AS pending_total,
        SUM(CASE WHEN due_date < CURRENT_DATE AND LOWER(COALESCE(payment_status, '')) NOT IN ('paid', 'completed') THEN 1 ELSE 0 END) AS overdue_payments,
        SUM(CASE WHEN due_date >= CURRENT_DATE AND due_date < DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS upcoming_payments_next_30_days
      FROM payment_schedule`);

    const [pipelineRows] = await connection.query(`SELECT
        SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('lead', 'prospect', 'active') THEN 1 ELSE 0 END) AS active_prospects,
        (SELECT COUNT(*) FROM crm_followups WHERE LOWER(COALESCE(status, '')) NOT IN ('completed', 'done', 'closed')) AS active_followups,
        (SELECT COUNT(*) FROM migration_plans WHERE LOWER(COALESCE(status, '')) = 'approved') AS approved_migration_plans,
        (SELECT COUNT(*) FROM import_batches WHERE LOWER(COALESCE(status, '')) = 'approved_for_migration') AS import_batches_approved
      FROM clients`);

    const collection = collectionRows[0] ?? {};
    const pipeline = pipelineRows[0] ?? {};
    const expectedTotal = Number(collection.expected_total ?? 0);
    const pendingTotal = Number(collection.pending_total ?? 0);

    const warnings = [];
    if (Object.values(counts).every((value) => value === 0)) warnings.push('Base de datos sin registros en entidades clave (clients, lots, contracts).');

    return {
      ok: activeDatabase === config.database,
      status: activeDatabase === config.database ? 'ok' : 'error',
      database: activeDatabase,
      mode: 'read_only',
      writesEnabled: false,
      generatedAt: new Date().toISOString(),
      source: { type: 'mariadb_readonly', metricsVersion: 'v026', snapshotVersion: 'v027' },
      summaryCards: {
        clients: buildSummaryCard('Clientes', counts.clients),
        lots: buildSummaryCard('Lotes', counts.lots),
        contracts: buildSummaryCard('Contratos', counts.contracts),
        expectedCollection: buildSummaryCard('Cobranza esperada', expectedTotal, { currency: 'MXN' }),
        pendingCollection: buildSummaryCard('Cobranza pendiente', pendingTotal, { currency: 'MXN' })
      },
      dashboard: {
        business: {
          clientsByStatus: rowsToStatusMap(clientsByStatusRows),
          lotsByStatus: rowsToStatusMap(lotsByStatusRows),
          contractsByStatus: rowsToStatusMap(contractsByStatusRows)
        },
        collection: {
          expectedTotal,
          paidTotal: Number(collection.paid_total ?? 0),
          pendingTotal,
          overduePayments: Number(collection.overdue_payments ?? 0),
          upcomingPaymentsNext30Days: Number(collection.upcoming_payments_next_30_days ?? 0)
        },
        pipeline: {
          activeProspects: Number(pipeline.active_prospects ?? 0),
          activeFollowups: Number(pipeline.active_followups ?? 0),
          approvedMigrationPlans: Number(pipeline.approved_migration_plans ?? 0),
          importBatchesApproved: Number(pipeline.import_batches_approved ?? 0)
        }
      },
      warnings,
      notes: ['Snapshot read-only. No escribe en BD.', 'Datos pueden aparecer en cero si aún no se cargó información real.']
    };
  } finally {
    await connection.end();
  }
}

export async function getDbReadonlySyntheticDashboard() {
  const config = loadDbConfig();
  const connection = await createDbConnection(config);
  try {
    const [databaseRows] = await connection.query('SELECT DATABASE() AS active_database');
    const activeDatabase = databaseRows[0]?.active_database ?? null;

    const property = await getSyntheticRow(connection, 'properties', ['id', 'name', 'status']);
    const lot = await getSyntheticRow(connection, 'lots', ['id', 'property_id', 'lot_code', 'status']);
    const client = await getSyntheticRow(connection, 'clients', ['id', 'full_name', 'status']);
    const contract = await getSyntheticRow(connection, 'contracts', ['id', 'client_id', 'lot_id', 'contract_code', 'contract_status']);
    const paymentSchedule = await getSyntheticRow(connection, 'payment_schedule', ['id', 'contract_id', 'installment_number', 'due_date', 'expected_amount', 'payment_status']);

    return {
      ok: activeDatabase === config.database,
      mode: 'read_only_synthetic_dashboard',
      writesEnabled: false,
      database: activeDatabase,
      syntheticOnly: true,
      syntheticToken: SYNTHETIC_TOKEN_V060,
      generatedAt: new Date().toISOString(),
      counts: {
        properties: await getSyntheticCount(connection, 'properties'),
        lots: await getSyntheticCount(connection, 'lots'),
        clients: await getSyntheticCount(connection, 'clients'),
        contracts: await getSyntheticCount(connection, 'contracts'),
        payment_schedule: await getSyntheticCount(connection, 'payment_schedule')
      },
      relationship: { property, lot, client, contract, paymentSchedule },
      warnings: ['Datos sintéticos de staging', 'No usar como datos reales de cliente']
    };
  } finally {
    await connection.end();
  }
}
