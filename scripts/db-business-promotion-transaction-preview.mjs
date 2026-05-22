#!/usr/bin/env node

const VERSION = 'v036';
const PHASE = 'business_promotion_transaction_preview';
const MODE = 'dry_run';
const SCOPE = 'business_promotion_transaction_preview';

const ALLOWED_TABLES = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const BLOCKED_TABLES = [
  'crm_users',
  'sellers',
  'crm_followups',
  'import_batches',
  'import_raw_rows',
  'migration_plans',
  'migration_plan_events',
  'audit_log'
];

const REQUIRED_FIELDS = {
  clients: ['localRef', 'fullName', 'email', 'phone'],
  properties: ['localRef', 'clientRef', 'propertyName'],
  lots: ['localRef', 'propertyRef', 'lotCode'],
  contracts: ['localRef', 'clientRef', 'lotRef', 'contractCode'],
  payment_schedule: ['localRef', 'contractRef', 'dueDate', 'amount']
};

function buildSafeDemoPayload() {
  return [
    {
      table: 'clients',
      localRef: 'tmp_client_001',
      fullName: 'Cliente Demo Transaccional',
      email: 'demo.transaction.preview@example.invalid',
      phone: '0000000000'
    },
    {
      table: 'properties',
      localRef: 'tmp_property_001',
      clientRef: 'tmp_client_001',
      propertyName: 'Predio Demo Transaccional',
      optionalAddress: ''
    },
    {
      table: 'lots',
      localRef: 'tmp_lot_001',
      propertyRef: 'tmp_property_001',
      lotCode: 'Lote Demo Transaccional'
    },
    {
      table: 'contracts',
      localRef: 'tmp_contract_001',
      clientRef: 'tmp_client_001',
      lotRef: 'tmp_lot_001',
      contractCode: 'Contrato Demo Transaccional'
    },
    {
      table: 'payment_schedule',
      localRef: 'tmp_payment_001',
      contractRef: 'tmp_contract_001',
      dueDate: '2026-12-31',
      amount: 1000
    }
  ];
}

function buildInvalidPayload() {
  return [
    { table: 'crm_users', localRef: 'tmp_user_001' },
    { table: 'properties', localRef: 'tmp_property_bad_001', clientRef: 'missing_client', propertyName: 'Predio Demo Invalido' },
    { table: 'contracts', localRef: 'tmp_contract_dup_001', clientRef: 'missing_client', lotRef: 'missing_lot', contractCode: 'Dup-01' },
    { table: 'contracts', localRef: 'tmp_contract_dup_001', clientRef: 'missing_client', lotRef: 'missing_lot', contractCode: 'Dup-02' }
  ];
}

function sanitizePreview(record) {
  return {
    ...record,
    email: record.email ?? null,
    phone: record.phone ?? null
  };
}

function validate(payload) {
  const warnings = [
    'No real DB connection is used by design.',
    'Preview does not execute writes by design.',
    'Fixture data is fictional and safe for dry-run.'
  ];
  const blockers = [];
  const relationChecks = [];
  const duplicateChecks = [];
  const conflictChecks = [];

  const seenRefs = new Set();
  const steps = payload.map((row, index) => {
    const requiredFields = REQUIRED_FIELDS[row.table] ?? ['localRef'];
    const missingFields = requiredFields.filter((f) => row[f] === undefined || row[f] === null || row[f] === '');

    const step = {
      order: index + 1,
      table: row.table,
      operation: 'insert',
      localRef: row.localRef ?? `tmp_${index + 1}`,
      dependsOn: [],
      status: 'ready',
      requiredFields,
      missingFields,
      warnings: [],
      conflicts: [],
      previewRecord: sanitizePreview(row)
    };

    if (!ALLOWED_TABLES.includes(step.table)) {
      step.status = 'blocked';
      const message = `Table ${step.table} is out of scope.`;
      step.conflicts.push(message);
      blockers.push(message);
    }

    const expectedTable = ALLOWED_TABLES[index];
    if (ALLOWED_TABLES.includes(step.table) && expectedTable !== step.table) {
      const message = `Insertion order violation at step ${step.order}: expected ${expectedTable}, got ${step.table}.`;
      step.status = 'blocked';
      step.conflicts.push(message);
      blockers.push(message);
    }

    if (step.localRef && seenRefs.has(step.localRef)) {
      const message = `Critical duplicate localRef detected: ${step.localRef}.`;
      step.status = 'blocked';
      step.conflicts.push(message);
      blockers.push(message);
      duplicateChecks.push({ type: 'duplicate_local_ref', localRef: step.localRef, table: step.table, critical: true });
    }
    seenRefs.add(step.localRef);

    if (missingFields.length > 0) {
      const message = `Missing required fields for ${step.table}/${step.localRef}: ${missingFields.join(', ')}`;
      step.status = 'blocked';
      step.conflicts.push(message);
      blockers.push(message);
    }

    if (row.optionalAddress === '') {
      warnings.push(`Optional field optionalAddress is empty on ${step.localRef}.`);
    }
    if (row.email && row.email.endsWith('@example.invalid')) {
      warnings.push(`Demo email detected on ${step.localRef}.`);
    }
    if (row.phone === '0000000000') {
      warnings.push(`Demo phone detected on ${step.localRef}.`);
    }

    return step;
  });

  const byRef = new Map(steps.map((s) => [s.localRef, s]));

  function checkDependency(step, key, expectedTable) {
    const ref = step.previewRecord[key];
    if (!ref) return;
    step.dependsOn.push(ref);
    const dep = byRef.get(ref);
    if (!dep || dep.table !== expectedTable) {
      const message = `Missing or invalid dependency ${key}=${ref} for ${step.table}/${step.localRef}.`;
      step.status = 'blocked';
      step.conflicts.push(message);
      blockers.push(message);
      relationChecks.push({ relation: `${step.table}.${key}`, ok: false, reason: message });
      return;
    }
    relationChecks.push({ relation: `${step.table}.${key}`, ok: true, from: step.localRef, to: ref });
  }

  for (const step of steps) {
    if (step.table === 'properties') checkDependency(step, 'clientRef', 'clients');
    if (step.table === 'lots') checkDependency(step, 'propertyRef', 'properties');
    if (step.table === 'contracts') {
      checkDependency(step, 'clientRef', 'clients');
      checkDependency(step, 'lotRef', 'lots');
    }
    if (step.table === 'payment_schedule') checkDependency(step, 'contractRef', 'contracts');
    if (step.status === 'blocked') {
      conflictChecks.push({ table: step.table, localRef: step.localRef, critical: true, conflicts: step.conflicts });
    }
  }

  const summary = {
    plannedTables: ALLOWED_TABLES.length,
    plannedInserts: steps.filter((s) => ALLOWED_TABLES.includes(s.table)).length,
    readySteps: steps.filter((s) => s.status === 'ready').length,
    skippedSteps: steps.filter((s) => s.status === 'skipped').length,
    blockedSteps: steps.filter((s) => s.status === 'blocked').length,
    warnings: warnings.length,
    conflicts: conflictChecks.length + duplicateChecks.length
  };

  return { summary, steps, relationChecks, duplicateChecks, conflictChecks, blockers, warnings };
}

function runPreview() {
  const valid = validate(buildSafeDemoPayload());
  const invalid = validate(buildInvalidPayload());

  return {
    ok: true,
    version: VERSION,
    phase: PHASE,
    mode: MODE,
    writesEnabled: false,
    scope: SCOPE,
    allowedTables: ALLOWED_TABLES,
    blockedTables: BLOCKED_TABLES,
    insertionOrder: ALLOWED_TABLES,
    summary: valid.summary,
    transactionPreview: {
      scenario: 'valid_demo',
      steps: valid.steps
    },
    relationChecks: valid.relationChecks,
    duplicateChecks: valid.duplicateChecks,
    conflictChecks: valid.conflictChecks,
    blockers: valid.blockers,
    warnings: valid.warnings,
    notes: [
      'No credentials are required for v036 preview.',
      'No database connection is opened in v036 preview.',
      'Invalid scenario executed internally for blocker validation.',
      `invalidScenarioBlockedSteps=${invalid.summary.blockedSteps}`
    ]
  };
}

try {
  console.log(JSON.stringify(runPreview(), null, 2));
} catch (error) {
  console.log(JSON.stringify({ ok: false, version: VERSION, phase: PHASE, mode: MODE, writesEnabled: false, error: { message: error?.message ?? 'Unknown error' } }, null, 2));
  process.exit(1);
}
