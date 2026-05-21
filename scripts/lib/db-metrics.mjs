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

export async function getDbReadonlyMetrics() {
  const config = loadDbConfig();
  const connection = await createDbConnection(config);

  try {
    const [databaseRows] = await connection.query('SELECT DATABASE() AS active_database');
    const activeDatabase = databaseRows[0]?.active_database ?? null;

    const counts = {
      clients: await getCount(connection, 'clients'),
      sellers: await getCount(connection, 'sellers'),
      properties: await getCount(connection, 'properties'),
      lots: await getCount(connection, 'lots'),
      contracts: await getCount(connection, 'contracts'),
      payment_schedule: await getCount(connection, 'payment_schedule'),
      crm_followups: await getCount(connection, 'crm_followups'),
      import_batches: await getCount(connection, 'import_batches'),
      migration_plans: await getCount(connection, 'migration_plans')
    };

    const [clientsByStatusRows] = await connection.query('SELECT status, COUNT(*) AS total FROM clients GROUP BY status');
    const [lotsByStatusRows] = await connection.query('SELECT status, COUNT(*) AS total FROM lots GROUP BY status');
    const [contractsByStatusRows] = await connection.query(
      'SELECT contract_status AS status, COUNT(*) AS total FROM contracts GROUP BY contract_status'
    );
    const [paymentsByStatusRows] = await connection.query(
      'SELECT payment_status AS status, COUNT(*) AS total FROM payment_schedule GROUP BY payment_status'
    );
    const [followupsByStatusRows] = await connection.query('SELECT status, COUNT(*) AS total FROM crm_followups GROUP BY status');

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

    return {
      ok: activeDatabase === config.database,
      status: activeDatabase === config.database ? 'ok' : 'error',
      database: activeDatabase,
      expectedDatabase: config.database,
      mode: 'read_only',
      writesEnabled: false,
      generatedAt: new Date().toISOString(),
      counts,
      business: {
        clientsByStatus: rowsToStatusMap(clientsByStatusRows),
        lotsByStatus: rowsToStatusMap(lotsByStatusRows),
        contractsByStatus: rowsToStatusMap(contractsByStatusRows),
        paymentsByStatus: rowsToStatusMap(paymentsByStatusRows),
        followupsByStatus: rowsToStatusMap(followupsByStatusRows)
      },
      collection: {
        expectedTotal: Number(collection.expected_total ?? 0),
        paidTotal: Number(collection.paid_total ?? 0),
        pendingTotal: Number(collection.pending_total ?? 0),
        overduePayments: Number(collection.overdue_payments ?? 0),
        upcomingPaymentsNext30Days: Number(collection.upcoming_payments_next_30_days ?? 0)
      },
      pipeline: {
        activeProspects: Number(pipeline.active_prospects ?? 0),
        activeFollowups: Number(pipeline.active_followups ?? 0),
        approvedMigrationPlans: Number(pipeline.approved_migration_plans ?? 0),
        importBatchesApproved: Number(pipeline.import_batches_approved ?? 0)
      }
    };
  } finally {
    await connection.end();
  }
}
