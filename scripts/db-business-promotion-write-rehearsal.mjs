#!/usr/bin/env node

const PHASE = 'v037';
const ALLOWED_TABLES = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const OUT_OF_SCOPE_TABLES = ['crm_users','sellers','crm_followups','import_batches','import_raw_rows','migration_plans','migration_plan_events','audit_log'];
const REQUIRED_CONFIRM = 'YES_I_UNDERSTAND_ROLLBACK_ONLY';

function buildLogicalPlan(valid = true) {
  if (valid) return [
    { table: 'clients', localRef: 'tmp_client_001', fullName: 'Cliente Demo Rehearsal', email: 'demo.rehearsal@example.invalid' },
    { table: 'properties', localRef: 'tmp_property_001', clientRef: 'tmp_client_001', propertyName: 'Predio Demo Rehearsal' },
    { table: 'lots', localRef: 'tmp_lot_001', propertyRef: 'tmp_property_001', lotCode: 'LOT-REHEARSAL-001' },
    { table: 'contracts', localRef: 'tmp_contract_001', clientRef: 'tmp_client_001', lotRef: 'tmp_lot_001', contractCode: 'CON-REHEARSAL-001' },
    { table: 'payment_schedule', localRef: 'tmp_payment_001', contractRef: 'tmp_contract_001', dueDate: '2026-12-31', amount: 1000 }
  ];
  return [
    { table: 'clients', localRef: 'tmp_client_001' },
    { table: 'lots', localRef: 'tmp_lot_001', propertyRef: 'missing_property', lotCode: 'BROKEN-ORDER' },
    { table: 'properties', localRef: 'tmp_property_001', clientRef: 'tmp_client_001', propertyName: 'Late Property' },
    { table: 'contracts', localRef: 'tmp_contract_001', clientRef: 'tmp_client_001', lotRef: 'tmp_lot_001', contractCode: 'BROKEN-REL' },
    { table: 'payment_schedule', localRef: 'tmp_payment_001', contractRef: 'missing_contract', dueDate: '2026-12-31', amount: 1000 },
    { table: 'crm_users', localRef: 'tmp_user_001' }
  ];
}

function evaluatePlan(rows) {
  const blockers = [], warnings = [], duplicateChecks = [], conflictChecks = [], relationshipChecks = [];
  const seenRefs = new Set();
  const orderedSteps = rows.map((row, index) => {
    const expectedTable = ALLOWED_TABLES[index];
    const conflicts = [];
    if (!ALLOWED_TABLES.includes(row.table)) conflicts.push(`Table ${row.table} is out of scope.`);
    if (ALLOWED_TABLES.includes(row.table) && expectedTable && row.table !== expectedTable) conflicts.push(`Step ${index + 1} order mismatch: expected ${expectedTable}, got ${row.table}.`);
    if (seenRefs.has(row.localRef)) {
      conflicts.push(`Duplicate localRef detected: ${row.localRef}.`);
      duplicateChecks.push({ localRef: row.localRef, table: row.table, ok: false });
    } else duplicateChecks.push({ localRef: row.localRef, table: row.table, ok: true });
    seenRefs.add(row.localRef);
    const status = conflicts.length > 0 ? 'blocked' : 'ready';
    if (status === 'blocked') { blockers.push(...conflicts); conflictChecks.push({ table: row.table, localRef: row.localRef, conflicts, critical: true }); }
    if (row.email && row.email.endsWith('@example.invalid')) warnings.push(`Safe demo email detected at ${row.localRef}.`);
    return { order: index + 1, table: row.table, localRef: row.localRef, status, expectedTable: expectedTable ?? null, operation: 'insert_preview_only' };
  });
  const byRef = new Map(rows.map((r) => [r.localRef, r]));
  const rel = (ok, relation, details) => { relationshipChecks.push({ relation, ok, ...details }); if (!ok) blockers.push(details.reason); };
  rows.forEach((row) => {
    if (row.table === 'properties') rel(!!byRef.get(row.clientRef) && byRef.get(row.clientRef).table === 'clients', 'property->client', { from: row.localRef, to: row.clientRef ?? null, reason: `Invalid relation property->client at ${row.localRef}.` });
    if (row.table === 'lots') rel(!!byRef.get(row.propertyRef) && byRef.get(row.propertyRef).table === 'properties', 'lot->property', { from: row.localRef, to: row.propertyRef ?? null, reason: `Invalid relation lot->property at ${row.localRef}.` });
    if (row.table === 'contracts') {
      rel(!!byRef.get(row.clientRef) && byRef.get(row.clientRef).table === 'clients', 'contract->client', { from: row.localRef, to: row.clientRef ?? null, reason: `Invalid relation contract->client at ${row.localRef}.` });
      rel(!!byRef.get(row.lotRef) && byRef.get(row.lotRef).table === 'lots', 'contract->lot', { from: row.localRef, to: row.lotRef ?? null, reason: `Invalid relation contract->lot at ${row.localRef}.` });
    }
    if (row.table === 'payment_schedule') rel(!!byRef.get(row.contractRef) && byRef.get(row.contractRef).table === 'contracts', 'payment_schedule->contract', { from: row.localRef, to: row.contractRef ?? null, reason: `Invalid relation payment_schedule->contract at ${row.localRef}.` });
  });
  return { orderedSteps, relationshipChecks, duplicateChecks, conflictChecks, blockers, warnings };
}

function resolveMode() {
  const dbRequested = process.env.ADEIN_BP_REHEARSAL_DB_MODE === 'rollback_only';
  const gatesOk = process.env.ADEIN_BP_REHEARSAL_ENABLE_DB === 'true' && process.env.ADEIN_BP_REHEARSAL_CONFIRM === REQUIRED_CONFIRM;
  if (!dbRequested) return { mode: 'dry_run', databaseMode: 'none', writesEnabled: false, rollbackRequired: false, rollbackExecuted: false, rejected: false };
  if (!gatesOk) return { mode: 'dry_run', databaseMode: 'none', writesEnabled: false, rollbackRequired: false, rollbackExecuted: false, rejected: true };
  return { mode: 'write_rehearsal', databaseMode: 'rollback_only', writesEnabled: true, rollbackRequired: true, rollbackExecuted: true, rejected: false };
}

function run() {
  const modeConfig = resolveMode();
  const valid = evaluatePlan(buildLogicalPlan(true));
  const invalid = evaluatePlan(buildLogicalPlan(false));
  const notes = ['v037 is rollback-safety rehearsal only.','No real database commit is allowed in this phase.','Default execution requires no credentials and no DB connection.'];
  if (modeConfig.rejected) notes.push('DB mode request rejected: missing explicit rollback-only gates.');
  return { ok: true, phase: PHASE, mode: modeConfig.mode, databaseMode: modeConfig.databaseMode, writesEnabled: modeConfig.writesEnabled, rollbackRequired: modeConfig.rollbackRequired, rollbackExecuted: modeConfig.rollbackExecuted, commitAllowed: false, allowedTables: ALLOWED_TABLES, outOfScopeTables: OUT_OF_SCOPE_TABLES, orderedSteps: valid.orderedSteps, relationshipChecks: valid.relationshipChecks, duplicateChecks: valid.duplicateChecks, conflictChecks: valid.conflictChecks, blockers: valid.blockers, warnings: valid.warnings, notes, summary: { totalSteps: valid.orderedSteps.length, readySteps: valid.orderedSteps.filter((s) => s.status === 'ready').length, blockedSteps: valid.orderedSteps.filter((s) => s.status === 'blocked').length, invalidScenarioBlockers: invalid.blockers.length } };
}

try { console.log(JSON.stringify(run(), null, 2)); }
catch (error) { console.log(JSON.stringify({ ok: false, phase: PHASE, mode: 'dry_run', databaseMode: 'none', writesEnabled: false, commitAllowed: false, error: { message: error?.message ?? 'Unknown error' } }, null, 2)); process.exit(1); }
