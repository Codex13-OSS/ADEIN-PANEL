#!/usr/bin/env node

const PHASE = 'v045';
const MODE = 'dry_run';
const DRY_RUN = true;
const COMMIT_ALLOWED = false;
const COMMIT_EXECUTED = false;
const PERSISTENT_WRITE_EXECUTED = false;

const TABLES_IN_SCOPE = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const TABLES_BLOCKED = ['crm_users', 'sellers', 'crm_followups', 'import_batches', 'import_raw_rows', 'migration_plans', 'migration_plan_events', 'audit_log'];
const RELATIONSHIP_ORDER = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];

const REQUIRED_COLUMNS = {
  clients: ['client_code', 'full_name', 'email'],
  properties: ['property_code', 'client_ref', 'property_name'],
  lots: ['lot_code', 'property_ref'],
  contracts: ['contract_code', 'client_ref', 'lot_ref', 'signed_at'],
  payment_schedule: ['contract_ref', 'installment_number', 'due_date', 'amount']
};

const FIXTURE = [
  { table: 'clients', localRef: 'demo_client_001', client_code: 'CLI-DEMO-001', full_name: 'Cliente Demo v045', email: 'cliente.demo.v045@example.invalid' },
  { table: 'properties', localRef: 'demo_property_001', property_code: 'PRO-DEMO-001', client_ref: 'demo_client_001', property_name: 'Predio Demo v045' },
  { table: 'lots', localRef: 'demo_lot_001', lot_code: 'LOT-DEMO-001', property_ref: 'demo_property_001' },
  { table: 'contracts', localRef: 'demo_contract_001', contract_code: 'CON-DEMO-001', client_ref: 'demo_client_001', lot_ref: 'demo_lot_001', signed_at: '2026-01-15' },
  { table: 'payment_schedule', localRef: 'demo_payment_001', contract_ref: 'demo_contract_001', installment_number: 1, due_date: '2026-02-15', amount: 1500 }
];

function isCommitRequested() {
  const commitSignal = process.env.ADEIN_DB_COMMIT;
  return commitSignal === '1' || commitSignal === 'true' || commitSignal === 'yes';
}

function validateScope(rows) {
  const uniqueTables = [...new Set(rows.map((row) => row.table))];
  const outsideScope = uniqueTables.filter((table) => !TABLES_IN_SCOPE.includes(table));
  const blockedDetected = uniqueTables.filter((table) => TABLES_BLOCKED.includes(table));
  const exactScope = TABLES_IN_SCOPE.every((table) => uniqueTables.includes(table)) && uniqueTables.length === TABLES_IN_SCOPE.length;

  return {
    ok: outsideScope.length === 0 && blockedDetected.length === 0 && exactScope,
    uniqueTables,
    outsideScope,
    blockedDetected,
    exactScope
  };
}

function validateRequiredColumns(rows) {
  const checks = rows.map((row) => {
    const required = REQUIRED_COLUMNS[row.table] || [];
    const missing = required.filter((column) => row[column] === undefined || row[column] === null || row[column] === '');
    return { table: row.table, localRef: row.localRef, required, missing, ok: missing.length === 0 };
  });

  return {
    ok: checks.every((check) => check.ok),
    checks
  };
}

function validateRelationshipOrder(rows) {
  const order = rows.map((row) => row.table);
  return {
    ok: JSON.stringify(order) === JSON.stringify(RELATIONSHIP_ORDER),
    expected: RELATIONSHIP_ORDER,
    actual: order
  };
}

function validateRelationships(rows) {
  const indexByRef = new Map(rows.map((row) => [row.localRef, row]));
  const checks = [
    { relation: 'property->client', ok: rows.every((r) => r.table !== 'properties' || indexByRef.get(r.client_ref)?.table === 'clients') },
    { relation: 'lot->property', ok: rows.every((r) => r.table !== 'lots' || indexByRef.get(r.property_ref)?.table === 'properties') },
    { relation: 'contract->client', ok: rows.every((r) => r.table !== 'contracts' || indexByRef.get(r.client_ref)?.table === 'clients') },
    { relation: 'contract->lot', ok: rows.every((r) => r.table !== 'contracts' || indexByRef.get(r.lot_ref)?.table === 'lots') },
    { relation: 'payment_schedule->contract', ok: rows.every((r) => r.table !== 'payment_schedule' || indexByRef.get(r.contract_ref)?.table === 'contracts') }
  ];

  return {
    ok: checks.every((check) => check.ok),
    checks
  };
}

function buildWritesPlanned(rows) {
  return rows.map((row, index) => ({
    order: index + 1,
    table: row.table,
    localRef: row.localRef,
    operation: 'insert_plan_in_memory_only',
    persistentWrite: false
  }));
}

function run() {
  if (isCommitRequested()) {
    return {
      ok: false,
      phase: PHASE,
      mode: MODE,
      dryRun: DRY_RUN,
      commitAllowed: COMMIT_ALLOWED,
      commitExecuted: COMMIT_EXECUTED,
      persistentWriteExecuted: PERSISTENT_WRITE_EXECUTED,
      approvalRequiredBeforeRealWrite: true,
      error: 'ADEIN_DB_COMMIT was provided but real commit is explicitly blocked in v045.',
      nextRecommendedPhase: 'v046-controlled-write-approval-artifact-or-server-side-commit-disabled-rehearsal'
    };
  }

  const scopeCheck = validateScope(FIXTURE);
  const requiredColumnsCheck = validateRequiredColumns(FIXTURE);
  const relationshipOrderCheck = validateRelationshipOrder(FIXTURE);
  const relationshipCheck = validateRelationships(FIXTURE);

  const warnings = [
    'Synthetic fixture only; no real data included.',
    'No DB connection is used in v045 dry-run.',
    'Real COMMIT remains blocked in this phase.'
  ];

  const ok = scopeCheck.ok && requiredColumnsCheck.ok && relationshipOrderCheck.ok && relationshipCheck.ok;

  return {
    ok,
    phase: PHASE,
    mode: MODE,
    dryRun: DRY_RUN,
    commitAllowed: COMMIT_ALLOWED,
    commitExecuted: COMMIT_EXECUTED,
    persistentWriteExecuted: PERSISTENT_WRITE_EXECUTED,
    writesPlanned: buildWritesPlanned(FIXTURE),
    tablesInScope: TABLES_IN_SCOPE,
    tablesBlocked: TABLES_BLOCKED,
    relationshipOrder: relationshipOrderCheck,
    requiredColumnsCheck,
    relationshipCheck,
    scopeCheck,
    approvalRequiredBeforeRealWrite: true,
    warnings,
    nextRecommendedPhase: 'v046-controlled-write-approval-artifact-or-server-side-commit-disabled-rehearsal'
  };
}

try {
  const result = run();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exit(1);
  }
} catch (error) {
  console.log(JSON.stringify({
    ok: false,
    phase: PHASE,
    mode: MODE,
    dryRun: DRY_RUN,
    commitAllowed: COMMIT_ALLOWED,
    commitExecuted: COMMIT_EXECUTED,
    persistentWriteExecuted: PERSISTENT_WRITE_EXECUTED,
    approvalRequiredBeforeRealWrite: true,
    error: error?.message ?? 'Unknown error in v045 dry-run.',
    nextRecommendedPhase: 'v046-controlled-write-approval-artifact-or-server-side-commit-disabled-rehearsal'
  }, null, 2));
  process.exit(1);
}
