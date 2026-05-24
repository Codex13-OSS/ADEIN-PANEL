#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const SCRIPT = 'scripts/db-controlled-persistent-write-candidate.mjs';
const EXPECTED_TABLES = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const EXPECTED_BLOCKED = ['crm_users', 'sellers', 'crm_followups', 'import_batches', 'import_raw_rows', 'migration_plans', 'migration_plan_events', 'audit_log'];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runCase(name, env = {}, expectCode = 0) {
  const result = spawnSync(process.execPath, [SCRIPT], { env: { ...process.env, ...env }, encoding: 'utf8' });

  let parsed;
  try {
    parsed = JSON.parse(result.stdout || '{}');
  } catch {
    throw new Error(`${name}: output is not valid JSON`);
  }

  if (result.status !== expectCode) {
    throw new Error(`${name}: expected exit ${expectCode} got ${result.status}`);
  }

  return parsed;
}

function main() {
  const out = runCase('default');
  assert(out.ok === true, 'default: ok must be true');
  assert(out.phase === 'v049', 'default: phase must be v049');
  assert(out.mode === 'controlled_persistent_write_candidate_planning', 'default: mode mismatch');
  assert(out.dryRun === true, 'default: dryRun must be true');
  assert(out.planningOnly === true, 'default: planningOnly must be true');
  assert(out.databaseConnectionAttempted === false, 'default: databaseConnectionAttempted must be false');
  assert(out.commitAllowed === false, 'default: commitAllowed must be false');
  assert(out.commitExecuted === false, 'default: commitExecuted must be false');
  assert(out.persistentWriteExecuted === false, 'default: persistentWriteExecuted must be false');
  assert(out.humanApprovalRequired === true, 'default: humanApprovalRequired must be true');
  assert(out.approvalArtifactRequired === true, 'default: approvalArtifactRequired must be true');
  assert(out.minimumSafeCommitCandidate === true, 'default: minimumSafeCommitCandidate must be true');
  assert(JSON.stringify(out.tablesInScope) === JSON.stringify(EXPECTED_TABLES), 'default: tablesInScope mismatch');
  for (const table of EXPECTED_BLOCKED) {
    assert(out.tablesBlocked.includes(table), `default: missing blocked table ${table}`);
  }
  assert(out.proposedWritePlan, 'default: proposedWritePlan missing');
  assert(out.safetyEnvelope, 'default: safetyEnvelope missing');
  assert(out.approvalArtifactCandidate, 'default: approvalArtifactCandidate missing');
  assert(out.nextRecommendedPhase, 'default: nextRecommendedPhase missing');

  const negatives = [
    { name: 'commit', env: { ADEIN_DB_COMMIT: '1' } },
    { name: 'allow-persistent-write', env: { ADEIN_DB_ALLOW_PERSISTENT_WRITE: '1' } },
    { name: 'enable-writes', env: { ADEIN_DB_ENABLE_WRITES: '1' } },
    { name: 'mode-write', env: { ADEIN_DB_MODE: 'write' } },
    { name: 'mode-read-write', env: { ADEIN_DB_MODE: 'read_write' } },
    { name: 'write-gate-real-commit', env: { ADEIN_DB_WRITE_GATE: 'REAL_COMMIT' } },
    { name: 'write-gate-v049-real-commit', env: { ADEIN_DB_WRITE_GATE: 'V049_REAL_COMMIT' } },
    { name: 'approval-token-real-commit', env: { ADEIN_DB_APPROVAL_TOKEN: 'APPROVE_REAL_COMMIT' } }
  ];

  for (const test of negatives) {
    const neg = runCase(`reject-${test.name}`, test.env, 1);
    assert(neg.ok === false, `${test.name}: expected ok false`);
  }

  console.log(JSON.stringify({ ok: true, phase: 'v049', mode: 'self_check_controlled_persistent_write_candidate_planning', checksPassed: 1 + negatives.length }, null, 2));
}

main();
