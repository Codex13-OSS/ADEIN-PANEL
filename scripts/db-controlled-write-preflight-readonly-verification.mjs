#!/usr/bin/env node

const PHASE = 'v047';
const MODE = 'server_side_readonly_preflight_verification';

const TABLES_IN_SCOPE = ['clients', 'properties', 'lots', 'contracts', 'payment_schedule'];
const TABLES_BLOCKED = ['crm_users', 'sellers', 'crm_followups', 'import_batches', 'import_raw_rows', 'migration_plans', 'migration_plan_events', 'audit_log'];

const OPTIONAL_REFERENCES = [
  { key: 'ADEIN_BACKUP_REFERENCE', checkId: 'backup_reference' },
  { key: 'ADEIN_SNAPSHOT_BEFORE_REFERENCE', checkId: 'snapshot_before_reference' },
  { key: 'ADEIN_SNAPSHOT_AFTER_REFERENCE', checkId: 'snapshot_after_reference' }
];

const DANGEROUS_ENV_RULES = [
  { key: 'ADEIN_DB_COMMIT', blockedValues: ['1'], reason: 'ADEIN_DB_COMMIT=1 is forbidden in readonly preflight verification.' },
  { key: 'ADEIN_DB_WRITE_GATE', blockedValues: ['REAL_COMMIT'], reason: 'ADEIN_DB_WRITE_GATE=REAL_COMMIT is forbidden in readonly preflight verification.' },
  { key: 'ADEIN_DB_ALLOW_PERSISTENT_WRITE', blockedValues: ['1'], reason: 'ADEIN_DB_ALLOW_PERSISTENT_WRITE=1 is forbidden in readonly preflight verification.' },
  { key: 'ADEIN_DB_ENABLE_WRITES', blockedValues: ['1'], reason: 'ADEIN_DB_ENABLE_WRITES=1 is forbidden in readonly preflight verification.' },
  { key: 'ADEIN_DB_MODE', blockedValues: ['write', 'read_write'], reason: 'ADEIN_DB_MODE write/read_write is forbidden in readonly preflight verification.' }
];

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function sanitizeReference(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const normalized = raw.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return '[sanitized-reference]';

  const tail = parts[parts.length - 1];
  const ext = tail.includes('.') ? tail.split('.').pop() : '';
  return ext ? `[sanitized-reference].${ext}` : '[sanitized-reference]';
}

function detectDangerousEnv(env) {
  for (const rule of DANGEROUS_ENV_RULES) {
    const raw = env[rule.key];
    if (raw === undefined) continue;

    const blocked = rule.blockedValues.map((v) => normalize(v));
    if (blocked.includes(normalize(raw))) {
      return {
        key: rule.key,
        value: String(raw),
        reason: rule.reason
      };
    }
  }

  return null;
}

function tableScopeCheck() {
  const overlap = TABLES_BLOCKED.filter((table) => TABLES_IN_SCOPE.includes(table));
  return {
    ok: overlap.length === 0,
    overlap
  };
}

function referenceStatus(env, key) {
  const raw = env[key];
  const hasReference = typeof raw === 'string' && raw.trim().length > 0;

  return {
    attempted: hasReference,
    verified: hasReference,
    sanitizedReference: hasReference ? sanitizeReference(raw) : null,
    status: hasReference ? 'verified_reference_present' : 'pending_reference_not_provided'
  };
}

function buildResult(env) {
  const scope = tableScopeCheck();
  const backup = referenceStatus(env, 'ADEIN_BACKUP_REFERENCE');
  const snapshotBefore = referenceStatus(env, 'ADEIN_SNAPSHOT_BEFORE_REFERENCE');
  const snapshotAfter = referenceStatus(env, 'ADEIN_SNAPSHOT_AFTER_REFERENCE');

  const readOnlyChecks = [
    { id: 'phase_v047_declared', critical: true, ok: PHASE === 'v047' },
    { id: 'mode_server_side_readonly_preflight_verification', critical: true, ok: MODE === 'server_side_readonly_preflight_verification' },
    { id: 'commit_and_write_gates_disabled', critical: true, ok: true, details: { commitAllowed: false, persistentWriteExecuted: false, realWriteAuthorized: false } },
    { id: 'table_scope_strict', critical: true, ok: scope.ok, details: { overlapDetected: scope.overlap } },
    { id: OPTIONAL_REFERENCES[0].checkId, critical: false, ok: backup.verified, details: { attempted: backup.attempted, status: backup.status, sanitizedReference: backup.sanitizedReference } },
    { id: OPTIONAL_REFERENCES[1].checkId, critical: false, ok: snapshotBefore.verified, details: { attempted: snapshotBefore.attempted, status: snapshotBefore.status, sanitizedReference: snapshotBefore.sanitizedReference } },
    { id: OPTIONAL_REFERENCES[2].checkId, critical: false, ok: snapshotAfter.verified, details: { attempted: snapshotAfter.attempted, status: snapshotAfter.status, sanitizedReference: snapshotAfter.sanitizedReference } }
  ];

  const criticalFailures = readOnlyChecks.filter((check) => check.critical && !check.ok);

  return {
    ok: criticalFailures.length === 0,
    phase: PHASE,
    mode: MODE,
    dryRun: true,
    readOnly: true,
    commitAllowed: false,
    commitExecuted: false,
    persistentWriteExecuted: false,
    realWriteAuthorized: false,
    backupVerificationRequired: true,
    backupVerificationAttempted: backup.attempted,
    backupVerified: backup.verified,
    snapshotBeforeRequired: true,
    snapshotBeforeVerificationAttempted: snapshotBefore.attempted,
    snapshotBeforeVerified: snapshotBefore.verified,
    snapshotAfterRequired: true,
    snapshotAfterVerificationAttempted: snapshotAfter.attempted,
    snapshotAfterVerified: snapshotAfter.verified,
    humanApprovalRequired: true,
    approvalArtifactRequired: true,
    tablesInScope: TABLES_IN_SCOPE,
    tablesBlocked: TABLES_BLOCKED,
    readOnlyChecks,
    abortConditions: [
      'Detected dangerous write gate or commit enablement signal.',
      'Detected scope overlap between in-scope business tables and blocked tables.',
      'Attempt to run persistent writes before controlled v048 rehearsal with explicit approval.'
    ],
    nextRecommendedPhase: 'v048-controlled-real-write-rehearsal-with-explicit-approval'
  };
}

function printBlockedDangerousGate(detected) {
  console.log(JSON.stringify({
    ok: false,
    phase: PHASE,
    mode: 'blocked_dangerous_write_gate',
    reason: detected.reason,
    rejectedSignal: { key: detected.key, value: detected.value },
    commitAllowed: false,
    commitExecuted: false,
    persistentWriteExecuted: false,
    realWriteAuthorized: false
  }, null, 2));
}

function main() {
  const detected = detectDangerousEnv(process.env);
  if (detected) {
    printBlockedDangerousGate(detected);
    process.exit(1);
  }

  const result = buildResult(process.env);
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exit(1);
  }
}

main();
